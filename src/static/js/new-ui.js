// Professional Interview Up-Sot Extractor - UI JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const recordBtn = document.getElementById('record-btn');
    const timecodeDisplay = document.getElementById('timecode');
    const leftMeter = document.getElementById('left-meter');
    const rightMeter = document.getElementById('right-meter');
    const upsotsCountSlider = document.getElementById('upsots-count');
    const upsotsCountValue = document.getElementById('upsots-count-value');
    const sensitivitySlider = document.getElementById('sensitivity');
    const sensitivityValue = document.getElementById('sensitivity-value');
    const transcriptInput = document.getElementById('transcript-input');
    const extractBtn = document.getElementById('extract-btn');
    const clearBtn = document.getElementById('clear-btn');
    const resultsContainer = document.getElementById('results-container');
    const microphoneSelect = document.getElementById('microphone-select');
    
    // State
    let isRecording = false;
    let recordingStartTime = null;
    let animationFrameId = null;
    let meterAnimationInterval = null;
    let availableMicrophones = [];
    
    // Initialize UI
    updateSliderValues();
    loadAvailableMicrophones();
    
    // Event Listeners
    recordBtn.addEventListener('click', toggleRecording);
    upsotsCountSlider.addEventListener('input', updateSliderValues);
    sensitivitySlider.addEventListener('input', updateSliderValues);
    extractBtn.addEventListener('click', extractKeyMoments);
    clearBtn.addEventListener('click', clearTranscript);
    microphoneSelect.addEventListener('change', handleMicrophoneChange);
    
    // Download buttons
    document.getElementById('download-txt').addEventListener('click', () => downloadResults('txt'));
    document.getElementById('download-pdf').addEventListener('click', () => downloadResults('pdf'));
    document.getElementById('download-edl').addEventListener('click', () => downloadResults('edl'));
    document.getElementById('email-btn').addEventListener('click', emailResults);
    
    // Functions for microphone handling
    async function loadAvailableMicrophones() {
        try {
            // First try to get microphones from the browser's media devices API
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                
                if (audioInputs.length > 0) {
                    // Clear existing options except the default
                    while (microphoneSelect.options.length > 1) {
                        microphoneSelect.remove(1);
                    }
                    
                    // Add detected microphones
                    audioInputs.forEach(device => {
                        const option = document.createElement('option');
                        option.value = device.deviceId;
                        option.text = device.label || `Microphone ${microphoneSelect.options.length}`;
                        microphoneSelect.appendChild(option);
                    });
                    
                    availableMicrophones = audioInputs;
                    return;
                }
            }
            
            // Fallback: fetch from backend API if browser API fails
            const response = await fetch('/api/transcription/get-available-microphones');
            const data = await response.json();
            
            if (data.success && data.microphones && data.microphones.length > 0) {
                // Clear existing options except the default
                while (microphoneSelect.options.length > 1) {
                    microphoneSelect.remove(1);
                }
                
                // Add microphones from API
                data.microphones.forEach(mic => {
                    const option = document.createElement('option');
                    option.value = mic.id;
                    option.text = mic.label;
                    microphoneSelect.appendChild(option);
                });
                
                availableMicrophones = data.microphones;
            }
        } catch (error) {
            console.error('Error loading microphones:', error);
            // Show error in status bar if available
            updateStatus('Error loading microphones: ' + error.message);
        }
    }
    
    function handleMicrophoneChange() {
        const selectedMicId = microphoneSelect.value;
        console.log('Selected microphone:', selectedMicId);
        
        // Store the selection for use during recording
        localStorage.setItem('selectedMicrophone', selectedMicId);
        
        // Update status
        updateStatus(`Microphone changed to: ${microphoneSelect.options[microphoneSelect.selectedIndex].text}`);
    }
    
    // Status bar and progress functions
    function updateStatus(message, progress = -1) {
        const statusMessage = document.getElementById('status-message');
        const progressBar = document.getElementById('progress-bar');
        
        if (statusMessage) {
            statusMessage.textContent = message;
        }
        
        if (progressBar && progress >= 0) {
            progressBar.style.width = `${Math.min(100, progress)}%`;
        } else if (progressBar) {
            progressBar.style.width = '0%';
        }
    }
    
    // Functions
    function toggleRecording() {
        isRecording = !isRecording;
        
        if (isRecording) {
            // Start recording
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
            recordBtn.classList.add('recording');
            recordingStartTime = Date.now();
            startTimecodeUpdate();
            startVUMeterAnimation();
            
            // Update status bar
            updateStatus('Recording in progress...', 25);
            
            // Use selected microphone if available
            const selectedMicId = microphoneSelect.value;
            if (selectedMicId !== 'default') {
                console.log('Using selected microphone:', selectedMicId);
            }
        } else {
            // Stop recording
            recordBtn.innerHTML = '<i class="fas fa-play"></i> Start Recording';
            recordBtn.classList.remove('recording');
            stopTimecodeUpdate();
            stopVUMeterAnimation();
            
            // Update status bar
            updateStatus('Processing recording...', 50);
            
            // Simulate processing delay
            setTimeout(() => {
                updateStatus('Extracting Up-Sots...', 75);
                setTimeout(() => {
                    showProcessingResults();
                    updateStatus('Processing complete!', 100);
                    
                    // Reset progress bar after a delay
                    setTimeout(() => {
                        updateStatus('Ready to record or process transcript');
                    }, 3000);
                }, 1000);
            }, 1500);
        }
    }
    
    function startTimecodeUpdate() {
        const updateTimecode = () => {
            const elapsed = Date.now() - recordingStartTime;
            const seconds = Math.floor((elapsed / 1000) % 60).toString().padStart(2, '0');
            const minutes = Math.floor((elapsed / (1000 * 60)) % 60).toString().padStart(2, '0');
            timecodeDisplay.textContent = `${minutes}:${seconds}`;
            
            if (isRecording) {
                animationFrameId = requestAnimationFrame(updateTimecode);
            }
        };
        
        updateTimecode();
    }
    
    function stopTimecodeUpdate() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    function startVUMeterAnimation() {
        // Simulate VU meter movement - synchronized in stereo
        meterAnimationInterval = setInterval(() => {
            // Same value for both meters to move in stereo (synchronized)
            const meterValue = Math.random() * 120 - 60; // -60 to 60 degrees
            
            // Apply same rotation to both needles for stereo movement
            leftMeter.style.transform = `translateX(-50%) rotate(${meterValue}deg)`;
            rightMeter.style.transform = `translateX(-50%) rotate(${meterValue}deg)`;
        }, 200);
    }
    
    function stopVUMeterAnimation() {
        if (meterAnimationInterval) {
            clearInterval(meterAnimationInterval);
            meterAnimationInterval = null;
            
            // Reset meters to default position
            leftMeter.style.transform = 'translateX(-50%) rotate(-60deg)';
            rightMeter.style.transform = 'translateX(-50%) rotate(-60deg)';
        }
    }
    
    function updateSliderValues() {
        upsotsCountValue.textContent = upsotsCountSlider.value;
        sensitivityValue.textContent = sensitivitySlider.value;
    }
    
    function extractKeyMoments() {
        // Show loading state
        extractBtn.disabled = true;
        extractBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Update status bar
        updateStatus('Extracting Up-Sots from transcript...', 25);
        
        // Get parameters for extraction
        const maxUpshots = parseInt(upsotsCountSlider.value);
        const sensitivity = parseInt(sensitivitySlider.value);
        const sortOrder = document.getElementById('sort-order').value;
        
        // Prepare request data
        const requestData = {
            transcript: transcriptInput.value,
            maxUpshots: maxUpshots,
            sensitivity: sensitivity,
            sortOrder: sortOrder
        };
        
        // Call the API to extract key moments
        fetch('/api/transcription/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            updateStatus('Processing transcript...', 50);
            return response.json();
        })
        .then(data => {
            updateStatus('Formatting results...', 75);
            
            if (data.success) {
                // Display the extracted up-sots
                displayResults(data.up_sots);
                updateStatus('Up-Sots extracted successfully!', 100);
            } else {
                // Show error
                resultsContainer.innerHTML = `<p class="error-message">Error: ${data.error || 'Failed to extract Up-Sots'}</p>`;
                updateStatus('Error extracting Up-Sots', -1);
            }
            
            // Reset button state
            extractBtn.disabled = false;
            extractBtn.innerHTML = '<i class="fas fa-bolt"></i> Extract Key Moments';
            
            // Reset progress bar after a delay
            setTimeout(() => {
                updateStatus('Ready to record or process transcript');
            }, 3000);
        })
        .catch(error => {
            console.error('Error extracting key moments:', error);
            resultsContainer.innerHTML = `<p class="error-message">Error: ${error.message || 'Failed to extract Up-Sots'}</p>`;
            
            // Reset button state
            extractBtn.disabled = false;
            extractBtn.innerHTML = '<i class="fas fa-bolt"></i> Extract Key Moments';
            
            // Update status
            updateStatus('Error: ' + error.message);
        });
    }
    
    function displayResults(upSots) {
        if (!upSots || upSots.length === 0) {
            resultsContainer.innerHTML = '<p class="placeholder-text">No valid timecoded content found</p>';
            return;
        }
        
        let resultsHTML = '<div class="results-list">';
        
        upSots.forEach(upSot => {
            resultsHTML += `
                <div class="result-item">
                    <div class="result-timecode">${upSot.timecode}</div>
                    <div class="result-text">${upSot.text}</div>
                </div>
            `;
        });
        
        resultsHTML += '</div>';
        resultsContainer.innerHTML = resultsHTML;
        
        // Add styles for results if not already added
        if (!document.getElementById('results-styles')) {
            const style = document.createElement('style');
            style.id = 'results-styles';
            style.textContent = `
                .results-list {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .result-item {
                    background-color: #f0e6d2;
                    border-left: 4px solid #8b5e34;
                    padding: 15px;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .result-timecode {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    color: #8b5e34;
                    margin-bottom: 5px;
                }
                .result-text {
                    color: #5d4037;
                    line-height: 1.4;
                }
                .error-message {
                    color: #cc3333;
                    text-align: center;
                    font-weight: bold;
                    padding: 20px;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function clearTranscript() {
        transcriptInput.value = '';
        resultsContainer.innerHTML = '<p class="placeholder-text">Extracted key moments will appear here</p>';
    }
    
    function downloadResults(format) {
        // Simulate download
        const btn = document.getElementById(`download-${format}`);
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
        
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            // Show success message
            const message = document.createElement('div');
            message.className = 'success-message';
            message.innerHTML = `<i class="fas fa-check-circle"></i> ${format.toUpperCase()} file downloaded`;
            message.style.position = 'fixed';
            message.style.bottom = '20px';
            message.style.right = '20px';
            message.style.backgroundColor = '#4CAF50';
            message.style.color = 'white';
            message.style.padding = '10px 20px';
            message.style.borderRadius = '5px';
            message.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            document.body.appendChild(message);
            
            setTimeout(() => {
                message.style.opacity = '0';
                message.style.transition = 'opacity 0.5s';
                setTimeout(() => document.body.removeChild(message), 500);
            }, 3000);
        }, 1500);
    }
    
    function emailResults() {
        // Simulate email sending
        const btn = document.getElementById('email-btn');
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            // Show success message
            const message = document.createElement('div');
            message.className = 'success-message';
            message.innerHTML = '<i class="fas fa-check-circle"></i> Results sent to station';
            message.style.position = 'fixed';
            message.style.bottom = '20px';
            message.style.right = '20px';
            message.style.backgroundColor = '#4CAF50';
            message.style.color = 'white';
            message.style.padding = '10px 20px';
            message.style.borderRadius = '5px';
            message.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            document.body.appendChild(message);
            
            setTimeout(() => {
                message.style.opacity = '0';
                message.style.transition = 'opacity 0.5s';
                setTimeout(() => document.body.removeChild(message), 500);
            }, 3000);
        }, 2000);
    }
});
