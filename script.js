document.addEventListener('DOMContentLoaded', () => {
    // API Keys and URLs
    const groqApiKey = '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';
    const groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    const geminiApiKey = 'AIzaSyBQTXAbNK0mUWDXXWnbpQwKrXuN-pfxouE';
    const geminiTtsApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

    // DOM Elements
    const langToggle = document.getElementById('language-toggle');
    const langText = document.getElementById('lang-text');
    const chatInput = document.getElementById('chat-input');
    const micBtn = document.getElementById('mic-btn');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');

    // State variables
    let isEnglish = false; // Default language is Hindi
    let conversationHistory = [];
    let audioPlayer = new Audio();
    let isSpeaking = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.interimResults = true;
        recognition.continuous = true;
    } else {
        micBtn.style.display = 'none';
        console.warn('SpeechRecognition API is not supported in this browser.');
    }

    // Function to toggle language
    langToggle.addEventListener('change', () => {
        isEnglish = !isEnglish;
        if (isEnglish) {
            langText.textContent = 'English';
            chatInput.placeholder = 'Type your message...';
            if (recognition) recognition.lang = 'en-US';
        } else {
            langText.textContent = 'हिंदी';
            chatInput.placeholder = 'अपना संदेश लिखें...';
            if (recognition) recognition.lang = 'hi-IN';
        }
    });

    // Function to display messages in the chat
    function addMessageToChat(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message-bubble', isUser ? 'user-message' : 'ai-message');
        messageDiv.textContent = message;
        chatHistory.insertBefore(messageDiv, chatHistory.firstChild);
    }

    // Function to handle loading state
    function showLoading(show) {
        if (show) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'loading';
            loadingDiv.classList.add('flex', 'justify-center', 'items-center', 'p-4');
            loadingDiv.innerHTML = '<div class="loader"></div>';
            chatHistory.insertBefore(loadingDiv, chatHistory.firstChild);
        } else {
            const loadingDiv = document.getElementById('loading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }
    }

    // Utility function to convert Base64 to ArrayBuffer
    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Utility function to convert PCM to WAV
    function pcmToWav(pcm16, sampleRate) {
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        let pos = 0;

        function writeString(str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(pos++, str.charCodeAt(i));
            }
        }

        function writeUint32(val) {
            view.setUint32(pos, val, true);
            pos += 4;
        }

        function writeUint16(val) {
            view.setUint16(pos, val, true);
            pos += 2;
        }

        writeString('RIFF');
        writeUint32(36 + pcm16.length * 2);
        writeString('WAVE');
        writeString('fmt ');
        writeUint32(16);
        writeUint16(1); // PCM format
        writeUint16(1); // Mono
        writeUint32(sampleRate);
        writeUint32(sampleRate * 2); // Byte rate
        writeUint16(2); // Block align
        writeUint16(16); // Bits per sample
        writeString('data');
        writeUint32(pcm16.length * 2);

        for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(pos, pcm16[i], true);
            pos += 2;
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    // Function to handle TTS
    async function speak(text) {
        if (isSpeaking) {
            audioPlayer.pause();
            isSpeaking = false;
        }
        showLoading(true);
        try {
            const payload = {
                contents: [{
                    parts: [{ text: text }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Kore" } // Using Kore for a male voice
                        }
                    }
                },
                model: "gemini-2.5-flash-preview-tts"
            };

            const response = await fetch(geminiTtsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiApiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`TTS API Error: ${errorData.error.message}`);
            }

            const result = await response.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;

            if (audioData && mimeType && mimeType.startsWith("audio/")) {
                const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
                const pcmData = base64ToArrayBuffer(audioData);
                const pcm16 = new Int16Array(pcmData);
                const wavBlob = pcmToWav(pcm16, sampleRate);
                const audioUrl = URL.createObjectURL(wavBlob);
                audioPlayer.src = audioUrl;
                audioPlayer.play();
                isSpeaking = true;
                audioPlayer.onended = () => {
                    isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                };
            } else {
                throw new Error("Invalid audio response from Gemini TTS.");
            }
        } catch (error) {
            console.error('Error:', error);
            addMessageToChat('माइक का उपयोग करने में कोई समस्या हुई। कृपया पुनः प्रयास करें।', false);
        } finally {
            showLoading(false);
        }
    }


    // Function to send message and get AI response
    async function sendMessage(message, isFromMic) {
        if (!message.trim()) return;

        addMessageToChat(message, true);
        showLoading(true);

        conversationHistory.push({ role: 'user', content: message });

        try {
            const response = await fetch(groqApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqApiKey}`
                },
                body: JSON.stringify({
                    model: "mixtral-8x7b-32768", // Groq model
                    messages: [
                        { role: "system", content: `You are a helpful AI assistant named Rupu AI. Your response should be in ${isEnglish ? 'English' : 'Hindi'}.` },
                        ...conversationHistory
                    ],
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error.message}`);
            }

            const data = await response.json();
            const aiText = data.choices[0].message.content.trim();
            addMessageToChat(aiText, false);
            conversationHistory.push({ role: 'assistant', content: aiText });

            if (isFromMic) {
                speak(aiText);
            }

        } catch (error) {
            console.error('Error:', error);
            addMessageToChat(`त्रुटि: ${error.message}. कृपया अपनी API कुंजी की जाँच करें।`, false);
        } finally {
            showLoading(false);
        }
    }

    // Event listener for send button
    sendBtn.addEventListener('click', () => {
        sendMessage(chatInput.value, false);
        chatInput.value = '';
    });

    // Event listener for enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage(chatInput.value, false);
            chatInput.value = '';
        }
    });

    // Microphone button event listener (toggle)
    if (recognition) {
        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
                isRecording = false;
                micBtn.classList.remove('mic-active');
            } else {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                        recognition.start();
                        isRecording = true;
                        micBtn.classList.add('mic-active');
                    })
                    .catch(err => {
                        console.error('Microphone access denied:', err);
                        addMessageToChat('माइक का उपयोग करने के लिए अनुमति आवश्यक है। कृपया अनुमति दें।', false);
                    });
            }
        });

        let liveTranscript = '';
        recognition.onresult = (e) => {
            let interimTranscript = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) {
                    liveTranscript += e.results[i][0].transcript;
                } else {
                    interimTranscript += e.results[i][0].transcript;
                }
            }
            chatInput.value = liveTranscript + interimTranscript;
        };

        recognition.onend = () => {
            if (isRecording) {
                if (liveTranscript.trim() !== '') {
                    sendMessage(liveTranscript, true);
                }
                liveTranscript = '';
                setTimeout(() => {
                   if (isRecording) {
                      recognition.start();
                   }
                }, 500);
            }
        };
        
        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            addMessageToChat('माइक का उपयोग करने में कोई समस्या हुई। कृपया पुनः प्रयास करें।', false);
            isRecording = false;
            micBtn.classList.remove('mic-active');
        };
    }
});
