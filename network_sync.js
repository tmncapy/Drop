/* network_sync.js - Centralized Native Backend Realtime WebSockets & Multi-Device Sync */

(function () {
    // Global IndexedDB Media Cache Helper for large media files (Videos / Images)
    const GameMediaCache = {
        dbName: 'GameshowMediaDB',
        storeName: 'media',
        dbPromise: null,

        open() {
            if (this.dbPromise) return this.dbPromise;
            this.dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    reject(new Error("IndexedDB not supported"));
                    return;
                }
                const req = indexedDB.open(this.dbName, 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName);
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
            return this.dbPromise;
        },

        async set(key, val) {
            if (!key || !val) return;
            try {
                const db = await this.open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(this.storeName, 'readwrite');
                    tx.objectStore(this.storeName).put(val, key);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => reject(e.target.error);
                });
            } catch(e) {
                console.warn("IndexedDB set error:", e);
                try {
                    sessionStorage.setItem('idb_fallback_' + key, val);
                } catch(err) {}
            }
        },

        async get(key) {
            if (!key) return null;
            try {
                const db = await this.open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(this.storeName, 'readonly');
                    const req = tx.objectStore(this.storeName).get(key);
                    req.onsuccess = () => resolve(req.result || sessionStorage.getItem('idb_fallback_' + key) || null);
                    req.onerror = () => resolve(sessionStorage.getItem('idb_fallback_' + key) || null);
                });
            } catch(e) {
                console.warn("IndexedDB get error:", e);
                return sessionStorage.getItem('idb_fallback_' + key) || null;
            }
        }
    };
    window.GameMediaCache = GameMediaCache;

    class GameSyncChannel {
        constructor(channelName) {
            const urlParams = new URLSearchParams(window.location.search);
            const customRoom = urlParams.get('room') || urlParams.get('channel');
            
            this.baseChannelName = channelName || 'gameshow_money_drop';
            this.topicName = customRoom ? `${this.baseChannelName}_${customRoom}` : `${this.baseChannelName}_main_channel_v2`;
            
            this.localChannel = new BroadcastChannel(this.baseChannelName);
            this.onmessageHandler = null;
            this.instanceId = 'client_' + Math.random().toString(36).substring(2, 9);
            this.isConnected = false;
            this.pendingQueue = [];
            this.processedMsgIds = new Map();
            this.backendWs = null;
            this.reconnectTimer = null;
            this.heartbeatTimer = null;
            this.mqttClient = null;

            // Detect current role
            let detectedRole = window.CURRENT_ROLE;
            if (!detectedRole) {
                const path = (window.location.pathname || '').toLowerCase();
                const file = path.split('/').pop() || '';
                if (file.includes('projector')) detectedRole = 'projector';
                else if (file.includes('answer')) detectedRole = 'answer';
                else if (file.includes('player')) detectedRole = 'player';
                else if (file.includes('host')) detectedRole = 'host';
                else if (file.includes('controller')) detectedRole = 'controller';
                else detectedRole = 'unknown';
            }
            this.currentRole = detectedRole;

            // Helper to prevent duplicate handling across BroadcastChannel & Backend WebSocket
            this.isDuplicateAndRecord = (payload) => {
                if (!payload || !payload._msgId) return false;
                const now = Date.now();
                if (this.processedMsgIds.size > 300) {
                    for (const [id, time] of this.processedMsgIds.entries()) {
                        if (now - time > 12000) {
                            this.processedMsgIds.delete(id);
                        }
                    }
                }
                if (this.processedMsgIds.has(payload._msgId)) {
                    return true;
                }
                this.processedMsgIds.set(payload._msgId, now);
                return false;
            };

            this.handleRemoteReload = (payload) => {
                if (!payload) return;
                const action = payload.action || payload.type;
                if (action === 'reload_role') {
                    const targetRole = (payload.data && payload.data.targetRole) || payload.targetRole || 'all';
                    if (targetRole === 'all' || targetRole === this.currentRole) {
                        console.warn(`🔄 Receiving remote reload signal for targetRole=${targetRole} (Current: ${this.currentRole}). Reloading...`);
                        setTimeout(() => {
                            window.location.reload();
                        }, 100);
                    }
                }
            };

            // 1. Listen to BroadcastChannel for local tabs on the same browser window
            this.localChannel.onmessage = (event) => {
                if (event.data && event.data._senderId !== this.instanceId) {
                    if (!this.isDuplicateAndRecord(event.data)) {
                        this.handleRemoteReload(event.data);
                        if (typeof this.onmessageHandler === 'function') {
                            this.onmessageHandler(event);
                        }
                    }
                }
            };

            // 2. Connect to the Central Authoritative Backend WebSocket Server
            this.initBackendWebSocket();
        }

        get onmessage() {
            return this.onmessageHandler;
        }

        set onmessage(handler) {
            this.onmessageHandler = handler;
        }

        initBackendWebSocket() {
            let wsUrl = '';
            if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${wsProto}//${window.location.host}/ws?role=${this.currentRole}&instance=${this.instanceId}`;
            } else {
                const customServer = localStorage.getItem('gameshow_server_url');
                if (customServer) {
                    const clean = customServer.replace(/^http/, 'ws').replace(/\/$/, '');
                    wsUrl = `${clean}/ws?role=${this.currentRole}&instance=${this.instanceId}`;
                }
            }

            if (!wsUrl) {
                console.warn('⚠️ No backend server URL found (running offline/file). Falling back to MQTT...');
                this.initMqtt();
                return;
            }

            this.connectBackendWs(wsUrl);
        }

        connectBackendWs(wsUrl) {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            console.log(`🔌 [WS SYNC] Connecting to Backend WebSocket: ${wsUrl} (Role: ${this.currentRole})`);
            try {
                this.backendWs = new WebSocket(wsUrl);

                this.backendWs.onopen = () => {
                    this.isConnected = true;
                    console.log(`🟢 [BACKEND WS CONNECTED] Synced with server for role: ${this.currentRole}`);
                    this.notifyConnectionStatus(true, '🟢 Trực tuyến (Backend Server WebSockets Connected)');

                    // Register this role with the backend server
                    this.backendWs.send(JSON.stringify({
                        action: 'register_role',
                        data: {
                            role: this.currentRole,
                            instanceId: this.instanceId,
                            url: window.location.href
                        },
                        _senderId: this.instanceId
                    }));

                    // Flush any pending queue
                    this.flushQueue();

                    // Start periodic keep-alive ping
                    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = setInterval(() => {
                        if (this.backendWs && this.backendWs.readyState === WebSocket.OPEN) {
                            try {
                                this.backendWs.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
                            } catch(e) {}
                        }
                    }, 15000);
                };

                this.backendWs.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (!payload) return;

                        if (payload.action === 'pong') return;

                        // Handshake Snapshot Sync from server when this role opens/reconnects
                        if (payload.action === 'sync_full_state') {
                            console.log(`📦 [STATE SYNC RECEIVED] Full game state received from backend server:`, payload.data);
                            this.replayServerStateToLocalRole(payload.data && payload.data.state);
                            if (typeof this.onmessageHandler === 'function') {
                                this.onmessageHandler({ data: payload });
                            }
                            return;
                        }

                        // Roles presence counter update
                        if (payload.action === 'roles_presence_update') {
                            this.updateRolesPresenceInUI(payload.data && payload.data.roles);
                            if (typeof this.onmessageHandler === 'function') {
                                this.onmessageHandler({ data: payload });
                            }
                            return;
                        }

                        // Standard game action
                        if (payload._senderId !== this.instanceId) {
                            if (!this.isDuplicateAndRecord(payload)) {
                                this.handleRemoteReload(payload);
                                if (typeof this.onmessageHandler === 'function') {
                                    this.onmessageHandler({ data: payload });
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Backend WS message parse error:', e);
                    }
                };

                this.backendWs.onclose = (event) => {
                    this.isConnected = false;
                    console.warn(`⚠️ [BACKEND WS CLOSED] Code: ${event.code}. Reconnecting in 2s...`);
                    this.notifyConnectionStatus(false, '🔴 Ngoại tuyến (Đang kết nối lại Backend Server...)');
                    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
                    this.reconnectTimer = setTimeout(() => this.connectBackendWs(wsUrl), 2000);
                };

                this.backendWs.onerror = (err) => {
                    console.warn('⚠️ [BACKEND WS ERROR]', err);
                    this.isConnected = false;
                };

            } catch (err) {
                console.error('WebSocket creation error:', err);
                this.reconnectTimer = setTimeout(() => this.connectBackendWs(wsUrl), 3000);
            }
        }

        // Automatic state recovery when a screen (e.g. Projector on 2nd device) connects late or reconnects
        replayServerStateToLocalRole(state) {
            if (!state || typeof this.onmessageHandler !== 'function') return;

            console.log(`🔄 Replaying authoritative server state for role: ${this.currentRole}`);

            // 1. Replay Round
            if (state.currentRound) {
                this.onmessageHandler({
                    data: {
                        action: 'change_round',
                        data: { round: state.doorRule || 4, roundNum: state.currentRound },
                        _senderId: 'server_replay'
                    }
                });
            }

            // 2. Replay Topics if active
            if (state.topics && state.topics.active) {
                this.onmessageHandler({
                    data: {
                        action: 'show_topics',
                        data: { topicA: state.topics.topicA, topicB: state.topics.topicB },
                        _senderId: 'server_replay'
                    }
                });
                if (state.topics.selected) {
                    this.onmessageHandler({
                        data: {
                            action: 'lock_topic',
                            data: { type: state.topics.selected },
                            _senderId: 'server_replay'
                        }
                    });
                }
            }

            // 3. Replay Question & Media if active
            if (state.question && (state.question.text || (state.question.mediaType && state.question.mediaType !== 'none'))) {
                this.onmessageHandler({
                    data: {
                        action: 'update_content',
                        data: {
                            question: state.question.text,
                            mediaType: state.question.mediaType,
                            mediaUrl: state.question.mediaUrl,
                            mediaKey: state.question.mediaKey
                        },
                        _senderId: 'server_replay'
                    }
                });

                if (state.mediaStage === 'center') {
                    this.onmessageHandler({
                        data: {
                            action: 'show_media',
                            data: {
                                mediaType: state.question.mediaType,
                                mediaUrl: state.question.mediaUrl,
                                mediaKey: state.question.mediaKey
                            },
                            _senderId: 'server_replay'
                        }
                    });
                }
            }

            // 4. Replay Answers if present
            if (state.answers) {
                for (let i = 1; i <= 4; i++) {
                    const ansText = state.answers[String(i)];
                    if (ansText !== undefined) {
                        this.onmessageHandler({
                            data: {
                                action: 'update_single_answer',
                                data: { id: i, text: ansText },
                                _senderId: 'server_replay'
                            }
                        });
                    }
                }
            }

            // 5. Replay Revealed Q&A
            if (state.answersRevealed) {
                this.onmessageHandler({
                    data: {
                        action: 'show_all_q_and_a',
                        data: {},
                        _senderId: 'server_replay'
                    }
                });
            }

            // 6. Replay Trapdoors
            if (state.trapdoors) {
                for (let i = 1; i <= 4; i++) {
                    if (state.trapdoors[String(i)]) {
                        this.onmessageHandler({
                            data: {
                                action: 'open_door',
                                data: { doorId: i },
                                _senderId: 'server_replay'
                            }
                        });
                    }
                }
            }

            // 7. Replay Clock Timer
            if (state.clock && state.clock.status && state.clock.status !== 'reset') {
                this.onmessageHandler({
                    data: {
                        action: 'timer_control',
                        data: {
                            status: state.clock.status,
                            time: state.clock.time,
                            sfxFile: state.clock.sfxFile
                        },
                        _senderId: 'server_replay'
                    }
                });
            }

            // 8. Replay Winning Money
            if (state.winningMoney && state.winningMoney.shown) {
                this.onmessageHandler({
                    data: {
                        action: 'show_winning_money',
                        data: { amount: state.winningMoney.amount },
                        _senderId: 'server_replay'
                    }
                });
            }

            // 9. Replay Progress HUD
            if (state.progressOverlay && state.progressOverlay.shown) {
                this.onmessageHandler({
                    data: {
                        action: 'show_progress',
                        data: {
                            remaining: state.progressOverlay.remaining,
                            money: state.progressOverlay.money
                        },
                        _senderId: 'server_replay'
                    }
                });
            }
        }

        updateRolesPresenceInUI(rolesSummary) {
            if (!rolesSummary) return;
            const projBadge = document.getElementById('roles-projector-online-badge');
            if (projBadge) {
                const count = rolesSummary.projector || 0;
                projBadge.innerText = count > 0 ? `🟢 Online (${count})` : `⚪ Offline`;
                projBadge.style.color = count > 0 ? '#34d399' : '#94a3b8';
            }

            const hostBadge = document.getElementById('roles-host-online-badge');
            if (hostBadge) {
                const count = rolesSummary.host || 0;
                hostBadge.innerText = count > 0 ? `🟢 Online (${count})` : `⚪ Offline`;
                hostBadge.style.color = count > 0 ? '#34d399' : '#94a3b8';
            }
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
                    console.log('✅ MQTT Library loaded successfully as static fallback.');
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
                        this.notifyConnectionStatus(true, '🟢 Trực tuyến (MQTT Connected)');
                        
                        this.mqttClient.subscribe(this.topicName, { qos: 0 }, (err) => {
                            if (!err) {
                                this.flushQueue();
                            }
                        });
                    });

                    this.mqttClient.on('message', (topic, message) => {
                        try {
                            const payload = JSON.parse(message.toString());
                            if (payload && payload._senderId !== this.instanceId) {
                                if (!this.isDuplicateAndRecord(payload)) {
                                    this.handleRemoteReload(payload);
                                    if (typeof this.onmessageHandler === 'function') {
                                        this.onmessageHandler({ data: payload });
                                    }
                                }
                            }
                        } catch (e) {}
                    });

                    this.mqttClient.on('error', () => {
                        this.mqttClient.end(true);
                        currentBrokerIdx++;
                        setTimeout(tryConnect, 1000);
                    });

                } catch (e) {
                    currentBrokerIdx++;
                    setTimeout(tryConnect, 1000);
                }
            };

            tryConnect();
        }

        flushQueue() {
            if (this.pendingQueue.length === 0) return;

            while (this.pendingQueue.length > 0) {
                const msg = this.pendingQueue.shift();
                if (this.backendWs && this.backendWs.readyState === WebSocket.OPEN) {
                    try {
                        this.backendWs.send(JSON.stringify(msg));
                    } catch(e) {}
                } else if (this.mqttClient && this.mqttClient.connected) {
                    try {
                        this.mqttClient.publish(this.topicName, JSON.stringify(msg), { qos: 0 });
                    } catch(e) {}
                }
            }
        }

        notifyConnectionStatus(online, customText) {
            const statusEls = document.querySelectorAll('.network-status-badge');
            statusEls.forEach(el => {
                if (online) {
                    el.style.color = '#00e676';
                    el.innerText = customText || '🟢 Trực tuyến (WebSockets Connected)';
                } else {
                    el.style.color = '#ff5252';
                    el.innerText = customText || '🔴 Ngoại tuyến (Đang kết nối lại...)';
                }
            });
        }

        postMessage(msg) {
            if (!msg) return;
            const msgId = msg._msgId || (this.instanceId + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
            const payload = Object.assign({}, msg, {
                _senderId: this.instanceId,
                _role: this.currentRole,
                _timestamp: Date.now(),
                _msgId: msgId
            });

            // 1. Instant local BroadcastChannel (same browser tab/window)
            try {
                this.localChannel.postMessage(payload);
            } catch (e) {}

            // 2. Authoritative Native Backend WebSocket Server (instant cross-device, all roles)
            let sentOverWs = false;
            if (this.backendWs && this.backendWs.readyState === WebSocket.OPEN) {
                try {
                    const str = JSON.stringify(payload);
                    this.backendWs.send(str);
                    sentOverWs = true;
                } catch (e) {
                    console.warn('WS postMessage send failed, falling back to HTTP:', e);
                }
            }

            // 3. Fallback: HTTP /api/realtime/broadcast endpoint if WebSocket is currently connecting
            if (!sentOverWs && window.location.protocol.startsWith('http')) {
                fetch('/api/realtime/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {
                    if (this.pendingQueue.length < 30) this.pendingQueue.push(payload);
                });
            } else if (!sentOverWs) {
                if (this.pendingQueue.length < 30) this.pendingQueue.push(payload);
                else this.pendingQueue.shift();
            }

            // 4. MQTT fallback if connected (for pure GitHub Pages static hosting)
            if (this.mqttClient && this.mqttClient.connected) {
                try {
                    const str = JSON.stringify(payload);
                    if (str.length < 204800) {
                        this.mqttClient.publish(this.topicName, str, { qos: 0 });
                    }
                } catch (e) {}
            }
        }
    }

    window.GameSyncChannel = GameSyncChannel;
})();
