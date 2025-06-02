// Professional Interview Upshot Extractor - Audio Recorder

/**
 * Audio Recorder module for handling audio recording functionality
 * This file contains the AudioRecorder class for recording and processing audio
 */

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.isRecording = false;
        this.onStatusChange = null;
        this.onDataAvailable = null;
    }

    /**
     * Initialize the audio recorder
     * @returns {Promise} - Promise resolving when initialization is complete
     */
    async initialize() {
        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create media recorder
            this.mediaRecorder = new MediaRecorder(this.stream);
            
            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    
                    if (this.onDataAvailable) {
                        this.onDataAvailable(event.data);
                    }
                }
            };
            
            this.mediaRecorder.onstart = () => {
                this.isRecording = true;
                this.audioChunks = [];
                
                if (this.onStatusChange) {
                    this.onStatusChange('recording');
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.isRecording = false;
                
                if (this.onStatusChange) {
                    this.onStatusChange('stopped');
                }
            };
            
            return true;
        } catch (error) {
            console.error('Error initializing audio recorder:', error);
            return false;
        }
    }

    /**
     * Start recording audio
     */
    startRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
            this.mediaRecorder.start(1000); // Collect data every second
        }
    }

    /**
     * Stop recording audio
     * @returns {Blob} - The recorded audio as a Blob
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            return audioBlob;
        }
        
        return null;
    }

    /**
     * Check if the recorder is currently recording
     * @returns {boolean} - True if recording, false otherwise
     */
    isCurrentlyRecording() {
        return this.isRecording;
    }

    /**
     * Release resources used by the recorder
     */
    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    }

    /**
     * Create an audio URL for playback
     * @param {Blob} audioBlob - The audio blob to create a URL for
     * @returns {string} - The URL for the audio blob
     */
    createAudioURL(audioBlob) {
        return URL.createObjectURL(audioBlob);
    }

    /**
     * Revoke an audio URL when no longer needed
     * @param {string} url - The URL to revoke
     */
    revokeAudioURL(url) {
        URL.revokeObjectURL(url);
    }
}

// Export the AudioRecorder class
const audioRecorder = new AudioRecorder();
