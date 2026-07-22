/* network_sync.js - Cross-Device Realtime Network Synchronization for GitHub Pages & Web Hosting */

(function () {
    class GameSyncChannel {
        constructor(channelName) {
            this.channelName = channelName || 'gameshow_money_drop';
            this.localChannel = new BroadcastChannel(this.channelName);
            this.onmessageHandler = null;
            this.instanceId = 'tab_' + Math.random().toString(36).substring(2, 9);
            this.roomCode = localStorage.getItem('game_pin') || '1234';
            this.mqttClient = null;
            this.isConnecting = false;

            // 1. Listen to local BroadcastChannel (Same-device browser tabs)
            this.localChannel.onmessage = (event) => {
                if (event.data && event.data._senderId !== this.instanceId) {
                    if (typeof this.onmessageHandler === 'function') {
                        this.onmessageHandler(event);
                    }
                }
            };

            // 2. Load MQTT Library for Cross-Device WebSockets
            this.loadMqttLibrary();
        }

        get onmessage() {
            return this.onmessageHandler;
        }

        set onmessage(handler) {
            this.onmessageHandler = handler;
        }

        loadMqttLibrary() {
            if (typeof window.mqtt !== 'undefined') {
                this.connectMqttEMQX();
                return;
            }

            const cdnUrls = [
                'https://unpkg.com/mqtt@5.3.4/dist/mqtt.min.js',
                'https://cdn.jsdelivr.net/npm/mqtt@5.3.4/dist/mqtt.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js'
            ];

            let index = 0;
            const tryNextCdn = () => {
                if (index >= cdnUrls.length) {
                    console.warn('⚠️ Could not load MQTT CDN. Falling back to local BroadcastChannel only.');
                    return;
                }
                const url = cdnUrls[index++];
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    console.log('✅ MQTT CDN loaded from:', url);
                    this.connectMqttEMQX();
                };
                script.onerror = () => {
                    console.warn('⚠️ MQTT CDN failed:', url);
                    tryNextCdn();
                };
                document.head.appendChild(script);
            };

            tryNextCdn();
        }

        connectMqttEMQX() {
            if (!window.mqtt || this.isConnecting) return;
            this.isConnecting = true;

            try {
                const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
                const topic = `gameshow_money_drop/${this.roomCode}`;

                this.mqttClient = window.mqtt.connect(brokerUrl, {
                    clientId: 'gs_' + this.instanceId,
                    keepalive: 30,
                    clean: true,
                    reconnectPeriod: 3000,
                    connectTimeout: 5000
                });

                this.mqttClient.on('connect', () => {
                    this.isConnecting = false;
                    console.log('🌐 [EMQX] Cross-Device Broker Connected! Topic:', topic);
                    this.mqttClient.subscribe(topic, { qos: 0 });
                });

                this.mqttClient.on('message', (receivedTopic, message) => {
                    try {
                        const payload = JSON.parse(message.toString());
                        if (payload && payload._senderId !== this.instanceId) {
                            if (typeof this.onmessageHandler === 'function') {
                                this.onmessageHandler({ data: payload });
                            }
                        }
                    } catch (e) {
                        console.error('MQTT JSON parse error:', e);
                    }
                });

                this.mqttClient.on('error', (err) => {
                    console.warn('⚠️ EMQX Broker connection error:', err);
                    this.isConnecting = false;
                    if (this.mqttClient) {
                        try { this.mqttClient.end(true); } catch(e){}
                    }
                    this.connectMqttHiveMQ();
                });

            } catch (e) {
                this.isConnecting = false;
                console.warn('⚠️ EMQX Init Exception:', e);
                this.connectMqttHiveMQ();
            }
        }

        connectMqttHiveMQ() {
            if (!window.mqtt) return;

            try {
                const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
                const topic = `gameshow_money_drop/${this.roomCode}`;

                this.mqttClient = window.mqtt.connect(brokerUrl, {
                    clientId: 'gs_hive_' + this.instanceId,
                    keepalive: 30,
                    clean: true,
                    reconnectPeriod: 3000
                });

                this.mqttClient.on('connect', () => {
                    console.log('🌐 [HiveMQ] Fallback Cross-Device Broker Connected! Topic:', topic);
                    this.mqttClient.subscribe(topic, { qos: 0 });
                });

                this.mqttClient.on('message', (receivedTopic, message) => {
                    try {
                        const payload = JSON.parse(message.toString());
                        if (payload && payload._senderId !== this.instanceId) {
                            if (typeof this.onmessageHandler === 'function') {
                                this.onmessageHandler({ data: payload });
                            }
                        }
                    } catch (e) {}
                });
            } catch (e) {
                console.warn('⚠️ HiveMQ Fallback Exception:', e);
            }
        }

        updateRoomCode(newCode) {
            if (!newCode || newCode === this.roomCode) return;
            const oldTopic = `gameshow_money_drop/${this.roomCode}`;
            this.roomCode = newCode;
            const newTopic = `gameshow_money_drop/${this.roomCode}`;

            if (this.mqttClient && this.mqttClient.connected) {
                try {
                    this.mqttClient.unsubscribe(oldTopic);
                    this.mqttClient.subscribe(newTopic, { qos: 0 });
                    console.log('🔄 Room topic updated to:', newTopic);
                } catch(e) {}
            }
        }

        postMessage(msg) {
            if (!msg) return;
            const payload = Object.assign({}, msg, { _senderId: this.instanceId });

            // Automatically check if action updates room code PIN
            if (payload.action === 'update_pin' && payload.data && payload.data.pin) {
                this.updateRoomCode(payload.data.pin);
            }

            // 1. Post to local BroadcastChannel (same browser on same device)
            try {
                this.localChannel.postMessage(payload);
            } catch (e) {
                console.warn('BroadcastChannel error:', e);
            }

            // 2. Publish to MQTT WebSocket Broker (Cross-device / Cross-network)
            if (this.mqttClient && this.mqttClient.connected) {
                try {
                    const topic = `gameshow_money_drop/${this.roomCode}`;
                    this.mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 });
                } catch (e) {
                    console.warn('MQTT publish error:', e);
                }
            }
        }
    }

    // Expose GameSyncChannel globally
    window.GameSyncChannel = GameSyncChannel;
})();
