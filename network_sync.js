/* network_sync.js - Cross-Device Realtime Network Synchronization for GitHub Pages & Web Hosting */

(function () {
    class GameSyncChannel {
        constructor(channelName) {
            // Read optional custom channel/room from URL query string, e.g. ?room=mygame
            const urlParams = new URLSearchParams(window.location.search);
            const customRoom = urlParams.get('room') || urlParams.get('channel');
            
            this.baseChannelName = channelName || 'gameshow_money_drop';
            // All pages in the app MUST connect to the same topic to communicate!
            this.topicName = customRoom ? `${this.baseChannelName}_${customRoom}` : `${this.baseChannelName}_main_channel_v2`;
            
            this.localChannel = new BroadcastChannel(this.baseChannelName);
            this.onmessageHandler = null;
            this.instanceId = 'client_' + Math.random().toString(36).substring(2, 9);
            this.mqttClient = null;
            this.isConnected = false;
            this.pendingQueue = [];

            // 1. Listen to BroadcastChannel for local tabs on same device
            this.localChannel.onmessage = (event) => {
                if (event.data && event.data._senderId !== this.instanceId) {
                    if (typeof this.onmessageHandler === 'function') {
                        this.onmessageHandler(event);
                    }
                }
            };

            // 2. Load MQTT Library for Cross-Device WebSockets
            this.initMqtt();
        }

        get onmessage() {
            return this.onmessageHandler;
        }

        set onmessage(handler) {
            this.onmessageHandler = handler;
        }

        initMqtt() {
            if (typeof window.mqtt !== 'undefined') {
                this.connectBrokers();
                return;
            }

            const cdns = [
                'https://unpkg.com/mqtt@5.3.4/dist/mqtt.min.js',
                'https://cdn.jsdelivr.net/npm/mqtt@5.3.4/dist/mqtt.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js'
            ];

            let idx = 0;
            const loadScript = () => {
                if (idx >= cdns.length) {
                    console.warn('⚠️ MQTT CDN unavailable, using BroadcastChannel local only.');
                    return;
                }
                const s = document.createElement('script');
                s.src = cdns[idx++];
                s.onload = () => {
                    console.log('✅ MQTT Library loaded successfully.');
                    this.connectBrokers();
                };
                s.onerror = () => loadScript();
                document.head.appendChild(s);
            };
            loadScript();
        }

        connectBrokers() {
            if (!window.mqtt) return;

            const brokers = [
                'wss://broker.emqx.io:8084/mqtt',
                'wss://broker.hivemq.com:8884/mqtt',
                'wss://test.mosquitto.org:8081/mqtt'
            ];

            let currentBrokerIdx = 0;

            const tryConnect = () => {
                if (currentBrokerIdx >= brokers.length) return;
                const brokerUrl = brokers[currentBrokerIdx];
                console.log(`🌐 Connecting to MQTT broker: ${brokerUrl} (Topic: ${this.topicName})`);

                try {
                    this.mqttClient = window.mqtt.connect(brokerUrl, {
                        clientId: 'gs_' + this.instanceId,
                        keepalive: 30,
                        clean: true,
                        reconnectPeriod: 4000,
                        connectTimeout: 6000
                    });

                    this.mqttClient.on('connect', () => {
                        this.isConnected = true;
                        console.log(`🟢 [MQTT ONLINE] Connected to ${brokerUrl} on topic: ${this.topicName}`);
                        
                        this.mqttClient.subscribe(this.topicName, { qos: 0 }, (err) => {
                            if (!err) {
                                this.flushQueue();
                                this.notifyConnectionStatus(true);
                                // Trigger initial handshake broadcast upon connection
                                if (typeof this.onmessageHandler === 'function') {
                                    this.onmessageHandler({ data: { action: 'mqtt_connected' } });
                                }
                            }
                        });
                    });

                    this.mqttClient.on('message', (topic, message) => {
                        try {
                            const payload = JSON.parse(message.toString());
                            if (payload && payload._senderId !== this.instanceId) {
                                if (typeof this.onmessageHandler === 'function') {
                                    this.onmessageHandler({ data: payload });
                                }
                            }
                        } catch (e) {
                            console.error('MQTT message parse error:', e);
                        }
                    });

                    this.mqttClient.on('error', (err) => {
                        console.warn(`⚠️ Broker error on ${brokerUrl}:`, err);
                        this.isConnected = false;
                        this.notifyConnectionStatus(false);
                        try { this.mqttClient.end(true); } catch(e){}
                        currentBrokerIdx++;
                        setTimeout(tryConnect, 1000);
                    });

                } catch (e) {
                    console.warn(`⚠️ Broker init exception on ${brokerUrl}:`, e);
                    currentBrokerIdx++;
                    setTimeout(tryConnect, 1000);
                }
            };

            tryConnect();
        }

        flushQueue() {
            if (!this.mqttClient || !this.mqttClient.connected) return;
            while (this.pendingQueue.length > 0) {
                const msg = this.pendingQueue.shift();
                try {
                    this.mqttClient.publish(this.topicName, JSON.stringify(msg), { qos: 0 });
                } catch (e) {}
            }
        }

        notifyConnectionStatus(online) {
            const statusEls = document.querySelectorAll('.network-status-badge');
            statusEls.forEach(el => {
                if (online) {
                    el.style.color = '#00e676';
                    el.innerText = '🟢 Trực tuyến (WebSockets Connected)';
                } else {
                    el.style.color = '#ff5252';
                    el.innerText = '🔴 Ngoại tuyến (Đang kết nối lại...)';
                }
            });
        }

        postMessage(msg) {
            if (!msg) return;
            const payload = Object.assign({}, msg, { _senderId: this.instanceId, _timestamp: Date.now() });

            // 1. Send via local BroadcastChannel (same browser tab/window)
            try {
                this.localChannel.postMessage(payload);
            } catch (e) {}

            // 2. Send via MQTT WebSocket (cross-device)
            if (this.mqttClient && this.mqttClient.connected) {
                try {
                    this.mqttClient.publish(this.topicName, JSON.stringify(payload), { qos: 0 });
                } catch (e) {
                    this.pendingQueue.push(payload);
                }
            } else {
                this.pendingQueue.push(payload);
                if (this.pendingQueue.length > 50) this.pendingQueue.shift();
            }
        }
    }

    window.GameSyncChannel = GameSyncChannel;
})();
