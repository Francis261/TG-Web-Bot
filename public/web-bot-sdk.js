/* Advanced Chat SDK - Full Features (chat-sdk.js) */

// Load Telegram Web App SDK
(function loadTelegramSDK() {
    if (typeof window.Telegram === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        document.head.appendChild(script);
    }
})();

class AdvancedChatSDK {
    constructor() {
        this.container = null;
        this.messagesContainer = null;
        this.inputElement = null;
        this.sendButton = null;
        this.moreButton = null;
        this.replyKeyboardContainer = null;
        this.moreCard = null;
        this.messages = new Map();
        this.messageIdCounter = 1;
        this.db = null;
        this.config = {
            title: "Chat Bot",
            avatar: "🤖",
            webhook_url: null,
            user: null, // Will be auto-filled from Telegram
            enableIndexDB: true
        };
        
        this.initIndexDB();
        this.initTelegramUser();
    }

    // Initialize IndexDB for chat history
    async initIndexDB() {
        if (!this.config.enableIndexDB) return;
        
        try {
            const request = indexedDB.open('ChatSDK_History', 1);
            
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                const objectStore = this.db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('user_id', 'user_id', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('type', 'type', { unique: false });
                console.log('📦 IndexDB initialized with user_id support');
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                // Load chat history after we have user ID
                setTimeout(() => this.loadChatHistory(), 1000);
            };
            
            request.onerror = (event) => {
                console.error('❌ IndexDB error:', event.target.errorCode);
            };
        } catch (error) {
            console.error('❌ IndexDB not supported:', error);
        }
    }

    // Update user profile in more card
    updateUserProfile() {
        if (this.moreCard && this.config.user) {
            const userProfile = this.moreCard.querySelector('.user-profile');
            if (userProfile) {
                userProfile.innerHTML = `
                    <div class="user-avatar">
                        ${this.config.user.photo_url ? 
                            `<img src="${this.config.user.photo_url}" alt="Profile">` : 
                            `<div class="avatar-placeholder">${this.config.user.first_name.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.config.user.first_name} ${this.config.user.last_name || ''}</div>
                        <div class="user-id">ID: ${this.config.user.id}</div>
                        ${this.config.user.username ? `<div class="user-username">@${this.config.user.username}</div>` : ''}
                        ${this.config.user.is_premium ? '<div class="user-premium">⭐ Premium</div>' : ''}
                    </div>
                `;
            }
        }
    }

    // Initialize Telegram user data
    initTelegramUser() {
        const checkTelegram = () => {
            if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                console.log('📱 Telegram WebApp detected:', tg);
                console.log('📱 InitData:', tg.initData);
                console.log('📱 InitDataUnsafe:', tg.initDataUnsafe);
                
                // Try to get user from initDataUnsafe first
                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const user = tg.initDataUnsafe.user;
                    this.config.user = {
                        id: user.id.toString(),
                        first_name: user.first_name,
                        last_name: user.last_name || '',
                        username: user.username || '',
                        language_code: user.language_code || 'en',
                        photo_url: user.photo_url || null,
                        is_premium: user.is_premium || false
                    };
                    console.log('✅ Telegram user loaded from initDataUnsafe:', this.config.user);
                    this.updateUserProfile();
                    return;
                }
                
                // Fallback: try to parse initData manually
                if (tg.initData) {
                    try {
                        const urlParams = new URLSearchParams(tg.initData);
                        const userParam = urlParams.get('user');
                        if (userParam) {
                            const user = JSON.parse(decodeURIComponent(userParam));
                            this.config.user = {
                                id: user.id.toString(),
                                first_name: user.first_name,
                                last_name: user.last_name || '',
                                username: user.username || '',
                                language_code: user.language_code || 'en',
                                photo_url: user.photo_url || null,
                                is_premium: user.is_premium || false
                            };
                            console.log('✅ Telegram user loaded from initData:', this.config.user);
                            this.updateUserProfile();
                            return;
                        }
                    } catch (e) {
                        console.warn('⚠️ Failed to parse Telegram initData:', e);
                    }
                }
                
                console.log('⚠️ No Telegram user data found, checking again...');
                setTimeout(checkTelegram, 200);
            } else {
                // Check if we're in Telegram WebApp context
                if (window.location.search.includes('tgWebAppData') || 
                    window.location.hash.includes('tgWebAppData') ||
                    document.referrer.includes('telegram')) {
                    console.log('📱 Telegram context detected, waiting for SDK...');
                    setTimeout(checkTelegram, 200);
                } else {
                    console.log('🌐 Not in Telegram WebApp, using fallback');
                    // Not in Telegram, stop checking after a reasonable time
                    if (!this.telegramCheckTimeout) {
                        this.telegramCheckTimeout = setTimeout(() => {
                            console.log('⏰ Telegram check timeout, using fallback user');
                        }, 3000);
                    }
                }
            }
        };
        
        // Start checking immediately
        checkTelegram();
        
        // Also listen for Telegram WebApp ready event
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(checkTelegram, 100);
        });
        
        // Listen for custom Telegram events
        window.addEventListener('TelegramWebAppReady', checkTelegram);
    }

    async init(selector, config = {}) {
        this.config = { ...this.config, ...config };
        this.container = document.querySelector(selector);
        
        if (!this.container) {
            throw new Error(`Element with selector "${selector}" not found`);
        }

        // Auto-generate user if not from Telegram
        if (!this.config.user || !this.config.user.id) {
            this.config.user = {
                id: this.generateUserId(),
                first_name: "User",
                last_name: "",
                username: "",
                language_code: "en",
                photo_url: null,
                is_premium: false
            };
        }

        console.log('✅ Advanced Bot initialized:', this.config);

        this.render();
        this.bindEvents();
        this.createMoreCard();
        
        // Set up Telegram WebApp if available
        this.setupTelegramWebApp();
        
        return this;
    }

    render() {
        this.container.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    <div class="bot-avatar">${this.config.avatar}</div>
                    <div class="bot-info">
                        <h3>${this.config.title}</h3>
                        <p>Online</p>
                    </div>
                </div>
                <div class="chat-messages"></div>
                <div class="typing-indicator">Bot is typing...</div>
                <div class="reply-keyboard-container hidden">
                    <div class="keyboard-scroll-area">
                        <div class="reply-keyboard"></div>
                    </div>
                </div>
                <div class="chat-input-container">
                    <button class="more-button" title="More options">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"/>
                        </svg>
                    </button>
                    <input type="text" class="chat-input" placeholder="Type a message...">
                    <button class="send-button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        this.messagesContainer = this.container.querySelector('.chat-messages');
        this.inputElement = this.container.querySelector('.chat-input');
        this.sendButton = this.container.querySelector('.send-button');
        this.moreButton = this.container.querySelector('.more-button');
        this.typingIndicator = this.container.querySelector('.typing-indicator');
        this.replyKeyboardContainer = this.container.querySelector('.reply-keyboard-container');
    }

    createMoreCard() {
        const moreCard = document.createElement('div');
        moreCard.className = 'more-card hidden';
        moreCard.innerHTML = `
            <div class="more-card-content">
                <div class="more-card-header">
                    <button class="more-card-close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="media-card">
                    <h3>📎 Send Media</h3>
                    <div class="media-buttons">
                        <button class="media-btn" data-type="photo">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>
                            </svg>
                            <span>Photo</span>
                        </button>
                        <button class="media-btn" data-type="video">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
                            </svg>
                            <span>Video</span>
                        </button>
                        <button class="media-btn" data-type="document">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>
                            </svg>
                            <span>Document</span>
                        </button>
                        <button class="media-btn" data-type="audio">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12,3V13.55C11.41,13.21 10.73,13 10,13A3,3 0 0,0 7,16A3,3 0 0,0 10,19A3,3 0 0,0 13,16V7H17V5H12V3Z"/>
                            </svg>
                            <span>Audio</span>
                        </button>
                    </div>
                </div>
                
                <div class="user-profile">
                    <div class="user-avatar">
                        ${this.config.user.photo_url ? 
                            `<img src="${this.config.user.photo_url}" alt="Profile">` : 
                            `<div class="avatar-placeholder">${this.config.user.first_name.charAt(0)}</div>`
                        }
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.config.user.first_name} ${this.config.user.last_name || ''}</div>
                        <div class="user-id">ID: ${this.config.user.id}</div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.appendChild(moreCard);
        this.moreCard = moreCard;
        
        // Update user profile if we have user data
        this.updateUserProfile();
        
        // Bind events
        this.bindMoreCardEvents();
    }

    // Setup Telegram WebApp features
    setupTelegramWebApp() {
        if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            
            // Configure Telegram WebApp
            tg.ready();
            tg.expand();
            
            // Set theme colors
            if (tg.setHeaderColor) {
                tg.setHeaderColor('#0088cc');
            }
            
            // Handle back button
            if (tg.BackButton) {
                tg.BackButton.onClick(() => {
                    this.hideMoreCard();
                });
            }
            
            // Handle main button
            if (tg.MainButton) {
                tg.MainButton.setText('Send Message');
                tg.MainButton.onClick(() => {
                    if (this.inputElement.value.trim()) {
                        this.handleUserInput();
                    }
                });
            }
            
            console.log('📱 Telegram WebApp configured');
        }
    }

    bindEvents() {
        this.sendButton.addEventListener('click', () => this.handleUserInput());
        this.inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserInput();
            }
        });
        
        this.moreButton.addEventListener('click', () => this.toggleMoreCard());
        
        // Prevent text selection on buttons
        document.addEventListener('selectstart', (e) => {
            if (e.target.closest('.keyboard-button, .inline-keyboard-button, .reply-keyboard-button')) {
                e.preventDefault();
            }
        });
    }

    bindMoreCardEvents() {
        const closeBtn = this.moreCard.querySelector('.more-card-close');
        closeBtn.addEventListener('click', () => this.hideMoreCard());
        
        const mediaButtons = this.moreCard.querySelectorAll('.media-btn');
        mediaButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                this.handleMediaSelection(type);
            });
        });
        
        // Close on outside click
        this.moreCard.addEventListener('click', (e) => {
            if (e.target === this.moreCard) {
                this.hideMoreCard();
            }
        });
    }

    toggleMoreCard() {
        if (this.moreCard.classList.contains('hidden')) {
            this.showMoreCard();
        } else {
            this.hideMoreCard();
        }
    }

    showMoreCard() {
        this.moreCard.classList.remove('hidden');
        setTimeout(() => this.moreCard.classList.add('visible'), 10);
    }

    hideMoreCard() {
        this.moreCard.classList.remove('visible');
        setTimeout(() => this.moreCard.classList.add('hidden'), 300);
    }

    handleMediaSelection(type) {
        console.log('📎 Media selected:', type);
        this.hideMoreCard();
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        
        switch (type) {
            case 'photo':
                input.accept = 'image/*';
                break;
            case 'video':
                input.accept = 'video/*';
                break;
            case 'audio':
                input.accept = 'audio/*';
                break;
            case 'document':
                input.accept = '*/*';
                break;
        }
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileUpload(file, type);
            }
        };
        
        input.click();
    }

    handleFileUpload(file, type) {
        console.log('📤 File upload:', file.name, type);
        
        // Show file message
        this.addUserMessage(`📎 ${file.name} (${this.formatFileSize(file.size)})`);
        
        // For demo, we'll just show a message
        // In real implementation, you'd upload the file to your server
        setTimeout(() => {
            this.addBotMessage(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} received: ${file.name}`);
        }, 1000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    handleUserInput() {
        const text = this.inputElement.value.trim();
        if (!text) return;

        console.log('📝 User sent:', text);
        
        this.addUserMessage(text);
        this.inputElement.value = '';
        this.hideReplyKeyboard();
        
        this.sendToWebhook(text, false);
    }

    handleButtonClick(callbackData, buttonType = 'callback') {
        console.log('🔘 Button clicked:', callbackData, buttonType);
        
        if (buttonType === 'url') {
            window.open(callbackData, '_blank');
            return;
        }
        
        if (buttonType === 'web_app') {
            window.location.href = callbackData;
            return;
        }
        
        this.sendToWebhook(callbackData, true);
    }

    async sendToWebhook(text, isButton) {
        if (!this.config.webhook_url) {
            console.error('❌ No webhook URL configured');
            return;
        }

        try {
            console.log('📤 Sending to webhook:', text);
            this.showTyping();

            const payload = {
                update_id: Date.now(),
                message: isButton ? null : {
                    message_id: Date.now(),
                    from: this.config.user,
                    chat: {
                        id: this.config.user.id,
                        type: "private",
                        first_name: this.config.user.first_name,
                        username: this.config.user.username
                    },
                    date: Math.floor(Date.now() / 1000),
                    text: text
                },
                callback_query: isButton ? {
                    id: Date.now().toString(),
                    from: this.config.user,
                    data: text
                } : null
            };

            const response = await fetch(this.config.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            this.hideTyping();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📥 Webhook response:', data);
            this.processWebhookResponse(data);

        } catch (error) {
            console.error('❌ Webhook error:', error);
            this.hideTyping();
            this.addBotMessage('❌ Connection error: ' + error.message);
        }
    }

    processWebhookResponse(response) {
        if (!response) return;

        if (response.method) {
            this.executeMethod(response);
        } else if (Array.isArray(response)) {
            response.forEach((method, index) => {
                setTimeout(() => this.executeMethod(method), index * 200);
            });
        }
    }

    executeMethod(method) {
        if (!method.method) return;

        console.log('⚙️ Executing:', method.method);

        switch (method.method.toLowerCase()) {
            case 'sendmessage':
                this.addBotMessage(method.text, method.reply_markup, method.is_private);
                break;
            case 'sendphoto':
                this.addBotPhoto(method.photo, method.caption, method.is_private);
                break;
            case 'sendchataction':
                if (method.action === 'typing') {
                    this.showTyping();
                    setTimeout(() => this.hideTyping(), method.duration || 2000);
                }
                break;
            case 'answercallbackquery':
                this.showNotification(method.text || 'Button clicked!');
                break;
        }
    }

    async addUserMessage(text) {
        const messageData = {
            id: this.generateMessageId(),
            type: 'user',
            text: text,
            timestamp: Date.now(),
            is_private: false
        };

        const messageEl = this.createMessageElement(messageData);
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        
        await this.saveMessageToDB(messageData);
    }

    async addBotMessage(text, replyMarkup = null, isPrivate = false) {
        const messageData = {
            id: this.generateMessageId(),
            type: 'bot',
            text: text,
            timestamp: Date.now(),
            is_private: isPrivate,
            reply_markup: replyMarkup
        };

        const messageEl = this.createMessageElement(messageData);
        this.messagesContainer.appendChild(messageEl);
        this.messages.set(messageData.id, messageEl);

        if (replyMarkup) {
            if (replyMarkup.inline_keyboard) {
                this.bindInlineKeyboard(messageEl, replyMarkup.inline_keyboard);
            } else if (replyMarkup.keyboard) {
                this.showReplyKeyboard(replyMarkup.keyboard);
            }
        }

        this.scrollToBottom();
        await this.saveMessageToDB(messageData);
        return messageData.id;
    }

    async addBotPhoto(photoUrl, caption = '', isPrivate = false) {
        const messageData = {
            id: this.generateMessageId(),
            type: 'bot',
            text: caption,
            media_type: 'photo',
            media_url: photoUrl,
            timestamp: Date.now(),
            is_private: isPrivate
        };

        const messageEl = this.createPhotoMessageElement(messageData);
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        
        await this.saveMessageToDB(messageData);
    }

    createMessageElement(messageData) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${messageData.type}`;
        messageEl.dataset.messageId = messageData.id;
        
        // Add private class if message is private
        if (messageData.is_private) {
            messageEl.classList.add('private');
        }

        let keyboardHtml = '';
        if (messageData.reply_markup && messageData.reply_markup.inline_keyboard) {
            keyboardHtml = this.generateInlineKeyboard(messageData.reply_markup.inline_keyboard);
        }

        messageEl.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">${this.escapeHtml(messageData.text)}</div>
                ${keyboardHtml}
                <div class="message-time">${this.getCurrentTime()}</div>
            </div>
        `;

        return messageEl;
    }

    createPhotoMessageElement(messageData) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${messageData.type}`;
        messageEl.dataset.messageId = messageData.id;
        
        if (messageData.is_private) {
            messageEl.classList.add('private');
        }

        messageEl.innerHTML = `
            <div class="message-bubble">
                <div class="message-media">
                    <img src="${messageData.media_url}" alt="Photo" style="max-width: 100%; border-radius: 8px;">
                    ${messageData.text ? `<div class="media-caption">${this.escapeHtml(messageData.text)}</div>` : ''}
                </div>
                <div class="message-time">${this.getCurrentTime()}</div>
            </div>
        `;

        return messageEl;
    }

    generateInlineKeyboard(keyboard) {
        let html = '<div class="inline-keyboard">';
        
        keyboard.forEach(row => {
            html += '<div class="inline-keyboard-row">';
            row.forEach(button => {
                const buttonData = button.callback_data || button.url || button.web_app?.url || button.text;
                const buttonType = button.url ? 'url' : (button.web_app ? 'web_app' : 'callback');
                
                html += `<button class="inline-keyboard-button" data-callback="${this.escapeHtml(buttonData)}" data-type="${buttonType}">${this.escapeHtml(button.text)}</button>`;
            });
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }

    showReplyKeyboard(keyboard) {
        const keyboardEl = this.replyKeyboardContainer.querySelector('.reply-keyboard');
        let html = '';
        
        keyboard.forEach(row => {
            html += '<div class="reply-keyboard-row">';
            row.forEach(button => {
                const buttonData = button.url || button.web_app?.url || button.text;
                const buttonType = button.url ? 'url' : (button.web_app ? 'web_app' : 'text');
                
                html += `<button class="reply-keyboard-button" data-text="${this.escapeHtml(buttonData)}" data-type="${buttonType}">${this.escapeHtml(button.text)}</button>`;
            });
            html += '</div>';
        });
        
        keyboardEl.innerHTML = html;
        this.replyKeyboardContainer.classList.remove('hidden');
        
        this.bindReplyKeyboard();
    }

    hideReplyKeyboard() {
        this.replyKeyboardContainer.classList.add('hidden');
    }

    bindInlineKeyboard(messageEl, keyboard) {
        const buttons = messageEl.querySelectorAll('.inline-keyboard-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const callbackData = button.getAttribute('data-callback');
                const buttonType = button.getAttribute('data-type');
                this.handleButtonClick(callbackData, buttonType);
            });
        });
    }

    bindReplyKeyboard() {
        const buttons = this.replyKeyboardContainer.querySelectorAll('.reply-keyboard-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const text = button.getAttribute('data-text');
                const buttonType = button.getAttribute('data-type');
                
                if (buttonType === 'text') {
                    this.addUserMessage(text);
                    this.sendToWebhook(text, false);
                } else {
                    this.handleButtonClick(text, buttonType);
                }
            });
        });
    }

    async saveMessageToDB(messageData) {
        if (!this.db || !this.config.user) return;
        
        try {
            // Add user_id to message data
            const messageWithUserId = {
                ...messageData,
                user_id: this.config.user.id
            };
            
            const transaction = this.db.transaction(['messages'], 'readwrite');
            const objectStore = transaction.objectStore('messages');
            objectStore.add(messageWithUserId);
            
            console.log('💾 Message saved to IndexDB for user:', this.config.user.id);
        } catch (error) {
            console.error('❌ Error saving to IndexDB:', error);
        }
    }

    async loadChatHistory() {
        if (!this.db || !this.config.user) return;
        
        try {
            const transaction = this.db.transaction(['messages'], 'readonly');
            const objectStore = transaction.objectStore('messages');
            const index = objectStore.index('user_id');
            const request = index.getAll(this.config.user.id);
            
            request.onsuccess = () => {
                const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
                
                if (messages.length > 0) {
                    console.log('📦 Loading chat history for user:', this.config.user.id, '- Messages:', messages.length);
                    
                    messages.forEach(messageData => {
                        if (messageData.media_type === 'photo') {
                            const messageEl = this.createPhotoMessageElement(messageData);
                            this.messagesContainer.appendChild(messageEl);
                        } else {
                            const messageEl = this.createMessageElement(messageData);
                            this.messagesContainer.appendChild(messageEl);
                            
                            if (messageData.type === 'bot' && messageData.reply_markup) {
                                if (messageData.reply_markup.inline_keyboard) {
                                    this.bindInlineKeyboard(messageEl, messageData.reply_markup.inline_keyboard);
                                }
                            }
                        }
                    });
                    
                    this.scrollToBottom();
                } else {
                    console.log('📦 No chat history found for user:', this.config.user.id);
                }
            };
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
        }
    }

    showNotification(text) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = text;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 2000);
    }

    showTyping() {
        this.typingIndicator.classList.add('show');
        this.scrollToBottom();
    }

    hideTyping() {
        this.typingIndicator.classList.remove('show');
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateMessageId() {
        return this.messageIdCounter++;
    }

    generateUserId() {
        let userId = localStorage.getItem('chat_sdk_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            localStorage.setItem('chat_sdk_user_id', userId);
        }
        return userId;
    }

    clearChat() {
        this.messagesContainer.innerHTML = '';
        this.messages.clear();
        this.hideReplyKeyboard();
        this.messageIdCounter = 1;
        
        // Clear IndexDB for current user only
        if (this.db && this.config.user) {
            const transaction = this.db.transaction(['messages'], 'readwrite');
            const objectStore = transaction.objectStore('messages');
            const index = objectStore.index('user_id');
            const request = index.getAllKeys(this.config.user.id);
            
            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => {
                    objectStore.delete(key);
                });
                console.log('🗑️ Cleared', keys.length, 'messages for user:', this.config.user.id);
            };
        }
    }
}

// Create global Api instance
window.Api = new AdvancedChatSDK();
