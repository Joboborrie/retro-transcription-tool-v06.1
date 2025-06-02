// Professional Interview Upshot Extractor - API Client

/**
 * API Client for handling backend communication
 * This file contains functions for interacting with the backend API
 */

class ApiClient {
    constructor() {
        this.baseUrl = '/api';
    }

    /**
     * Send audio data to the backend for processing
     * @param {Blob} audioBlob - The recorded audio data
     * @returns {Promise} - Promise resolving to the processing results
     */
    async processAudio(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');
            
            const response = await fetch(`${this.baseUrl}/transcription/process`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error processing audio:', error);
            throw error;
        }
    }

    /**
     * Process transcript text to extract key moments
     * @param {string} transcript - The transcript text with timecodes
     * @param {Object} options - Processing options
     * @returns {Promise} - Promise resolving to the extracted moments
     */
    async processTranscript(transcript, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/transcription/extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcript,
                    maxUpshots: options.maxUpshots || 10,
                    sensitivity: options.sensitivity || 3,
                    sortOrder: options.sortOrder || 'chronological'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error processing transcript:', error);
            throw error;
        }
    }

    /**
     * Download results in specified format
     * @param {Array} results - The extracted moments
     * @param {string} format - The format to download (txt, pdf, edl)
     * @returns {Promise} - Promise resolving to the download URL
     */
    async downloadResults(results, format) {
        try {
            const response = await fetch(`${this.baseUrl}/export/${format}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ results })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            return await response.blob();
        } catch (error) {
            console.error(`Error downloading ${format}:`, error);
            throw error;
        }
    }

    /**
     * Send results via email
     * @param {Array} results - The extracted moments
     * @param {string} email - The recipient email address
     * @returns {Promise} - Promise resolving to the email status
     */
    async emailResults(results, email) {
        try {
            const response = await fetch(`${this.baseUrl}/export/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ results, email })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    }
}

// Export the API client
const apiClient = new ApiClient();
