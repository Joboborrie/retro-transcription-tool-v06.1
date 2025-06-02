"""
API routes for transcription functionality
"""

from flask import Blueprint, request, jsonify, current_app, send_file
import os
import json
import time
from datetime import datetime
import tempfile
import uuid

from src.models.transcription.audio_processor import AudioProcessor
from src.models.transcription.output_generator import OutputGenerator
from src.models.transcription.script_matcher import ScriptMatcher
from src.models.transcription.parameter_controls import ParameterControls
from src.models.transcription.email_service import EmailService

# Create blueprint
transcription_bp = Blueprint('transcription', __name__)

# Initialize components
audio_processor = AudioProcessor()
output_generator = OutputGenerator()
script_matcher = ScriptMatcher()
parameter_controls = ParameterControls()
email_service = EmailService()

# Session storage (in-memory for development)
sessions = {}

@transcription_bp.route('/upload-audio', methods=['POST'])
def upload_audio():
    """
    Handle audio file upload
    """
    try:
        # Check if file is in request
        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # Check if filename is empty
        if audio_file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Save audio file
        audio_data = audio_file.read()
        file_path = audio_processor.save_audio_file(audio_data)
        
        # Store session data
        sessions[session_id] = {
            'audio_file': file_path,
            'timestamp': datetime.now().isoformat(),
            'status': 'uploaded',
            'parameters': parameter_controls.get_parameters()
        }
        
        return jsonify({
            'success': True, 
            'session_id': session_id,
            'message': 'Audio uploaded successfully'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/record-audio', methods=['POST'])
def record_audio():
    """
    Handle audio data from browser recording
    """
    try:
        # Check if audio data is in request
        if 'audio_data' not in request.files:
            return jsonify({'success': False, 'error': 'No audio data provided'}), 400
        
        audio_data = request.files['audio_data'].read()
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Save audio file
        file_path = audio_processor.save_audio_file(audio_data)
        
        # Store session data
        sessions[session_id] = {
            'audio_file': file_path,
            'timestamp': datetime.now().isoformat(),
            'status': 'recorded',
            'parameters': parameter_controls.get_parameters()
        }
        
        return jsonify({
            'success': True, 
            'session_id': session_id,
            'message': 'Audio recorded successfully'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/transcribe/<session_id>', methods=['POST'])
def transcribe(session_id):
    """
    Transcribe audio for a given session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Check if audio file exists
        if 'audio_file' not in session or not os.path.exists(session['audio_file']):
            return jsonify({'success': False, 'error': 'Audio file not found'}), 404
        
        # Update parameters if provided
        if request.json and 'parameters' in request.json:
            parameter_controls.set_parameters(request.json['parameters'])
            session['parameters'] = parameter_controls.get_parameters()
        
        # Transcribe audio
        result = audio_processor.transcribe_audio(session['audio_file'])
        
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Transcription failed')}), 500
        
        # Store transcription results
        session['transcription'] = result
        session['status'] = 'transcribed'
        
        # Get up-sots based on parameters
        params = session['parameters']
        up_sots = audio_processor.get_up_sots(
            result['segments'],
            max_count=params['up_sots_count'],
            sensitivity=params['sensitivity'],
            sort_by_relevance=params['sort_by_relevance'],
            reference_script=session.get('script', '')
        )
        
        # Store up-sots
        session['up_sots'] = up_sots
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'segments_count': len(result['segments']),
            'up_sots_count': len(up_sots),
            'up_sots': up_sots,
            'full_transcript': result['full_transcript']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/extract', methods=['POST'])
def extract_key_moments():
    """
    Extract key moments from transcript text
    This endpoint is used by the frontend to process transcript text directly
    """
    try:
        # Check if transcript is provided
        if not request.json or 'transcript' not in request.json:
            return jsonify({'success': False, 'error': 'No transcript provided'}), 400
        
        transcript = request.json['transcript']
        
        # Get parameters from request or use defaults
        max_upsots = request.json.get('maxUpshots', 10)
        sensitivity = request.json.get('sensitivity', 3)
        sort_order = request.json.get('sortOrder', 'chronological')
        
        # Process the transcript to extract key moments
        # This is a simplified version that extracts timecoded segments
        segments = []
        
        # Extract timecodes and text using regex pattern
        import re
        pattern = r'(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})\s+(.*?)(?=\s+\d{2}:\d{2}|\s*$)'
        matches = re.finditer(pattern, transcript)
        
        for match in matches:
            timecode = match.group(1)
            text = match.group(2).strip()
            
            if text:
                segments.append({
                    'timecode': timecode,
                    'text': text,
                    'relevance': 1.0  # Default relevance score
                })
        
        # Sort segments based on sort order
        if sort_order == 'chronological':
            # Already in chronological order
            pass
        elif sort_order == 'relevance':
            # Sort by relevance (would normally use NLP for this)
            # For demo, just use length as a proxy for relevance
            segments.sort(key=lambda x: len(x['text']), reverse=True)
        elif sort_order == 'duration':
            # Sort by duration (would normally calculate this)
            # For demo, just use random values
            import random
            for segment in segments:
                segment['duration'] = random.uniform(1.0, 10.0)
            segments.sort(key=lambda x: x.get('duration', 0), reverse=True)
        
        # Limit to max_upsots
        segments = segments[:max_upsots]
        
        return jsonify({
            'success': True,
            'up_sots': segments,
            'count': len(segments)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/set-parameters/<session_id>', methods=['POST'])
def set_parameters(session_id):
    """
    Set parameters for a session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        # Check if parameters are provided
        if not request.json:
            return jsonify({'success': False, 'error': 'No parameters provided'}), 400
        
        # Update parameters
        updated_params = parameter_controls.set_parameters(request.json)
        sessions[session_id]['parameters'] = updated_params
        
        # Update up-sots if transcription exists
        if 'transcription' in sessions[session_id] and sessions[session_id]['transcription'].get('success', False):
            segments = sessions[session_id]['transcription']['segments']
            
            up_sots = audio_processor.get_up_sots(
                segments,
                max_count=updated_params['up_sots_count'],
                sensitivity=updated_params['sensitivity'],
                sort_by_relevance=updated_params['sort_by_relevance'],
                reference_script=sessions[session_id].get('script', '')
            )
            
            sessions[session_id]['up_sots'] = up_sots
            
            return jsonify({
                'success': True,
                'parameters': updated_params,
                'up_sots': up_sots
            })
        
        return jsonify({
            'success': True,
            'parameters': updated_params
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/set-script/<session_id>', methods=['POST'])
def set_script(session_id):
    """
    Set reference script for a session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        # Check if script is provided
        if not request.json or 'script' not in request.json:
            return jsonify({'success': False, 'error': 'No script provided'}), 400
        
        script_text = request.json['script']
        
        # Set script in script matcher
        result = script_matcher.set_reference_script(script_text)
        
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Failed to set script')}), 500
        
        # Store script in session
        sessions[session_id]['script'] = script_text
        
        # Update up-sots if transcription exists and sort by relevance is enabled
        if ('transcription' in sessions[session_id] and 
            sessions[session_id]['transcription'].get('success', False) and
            sessions[session_id]['parameters']['sort_by_relevance']):
            
            segments = sessions[session_id]['transcription']['segments']
            
            # Score segments based on script
            scored_segments = script_matcher.score_transcript_segments(segments)
            
            # Get up-sots based on parameters
            params = sessions[session_id]['parameters']
            up_sots = audio_processor.get_up_sots(
                scored_segments,
                max_count=params['up_sots_count'],
                sensitivity=params['sensitivity'],
                sort_by_relevance=True,
                reference_script=script_text
            )
            
            sessions[session_id]['up_sots'] = up_sots
            
            return jsonify({
                'success': True,
                'script_info': result,
                'up_sots': up_sots
            })
        
        return jsonify({
            'success': True,
            'script_info': result
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/generate-output/<session_id>', methods=['POST'])
def generate_output(session_id):
    """
    Generate output files for a session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Check if up-sots exist
        if 'up_sots' not in session or not session['up_sots']:
            return jsonify({'success': False, 'error': 'No up-sots available'}), 400
        
        # Get format selections
        formats = request.json.get('formats', {'txt': True, 'pdf': True, 'edl': True})
        
        # Generate timestamp for filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"transcript_{timestamp}"
        
        # Generate outputs
        results = output_generator.generate_all_outputs(
            session['up_sots'],
            session['audio_file'],
            formats=formats,
            base_filename=base_filename
        )
        
        if not results['success']:
            return jsonify({'success': False, 'error': 'Failed to generate outputs'}), 500
        
        # Store output files in session
        session['outputs'] = results['files']
        
        # Prepare response with download URLs
        download_urls = {}
        for fmt, file_info in results['files'].items():
            download_urls[fmt] = f"/api/transcription/download/{session_id}/{fmt}"
        
        return jsonify({
            'success': True,
            'formats': list(results['files'].keys()),
            'download_urls': download_urls
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/download/<session_id>/<format>', methods=['GET'])
def download_output(session_id, format):
    """
    Download output file for a session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Check if outputs exist
        if 'outputs' not in session or not session['outputs']:
            return jsonify({'success': False, 'error': 'No outputs available'}), 400
        
        # Check if requested format exists
        if format not in session['outputs']:
            return jsonify({'success': False, 'error': f'No {format.upper()} output available'}), 400
        
        file_info = session['outputs'][format]
        file_path = file_info['path']
        
        # Check if file exists
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'Output file not found'}), 404
        
        # Send file
        return send_file(
            file_path,
            as_attachment=True,
            download_name=file_info['filename']
        )
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/send-email/<session_id>', methods=['POST'])
def send_email(session_id):
    """
    Send output files via email
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Check if outputs exist
        if 'outputs' not in session or not session['outputs']:
            return jsonify({'success': False, 'error': 'No outputs available'}), 400
        
        # Check if email is provided
        if not request.json or 'email' not in request.json:
            return jsonify({'success': False, 'error': 'No email provided'}), 400
        
        recipient_email = request.json['email']
        
        # Get EDL file path
        if 'edl' not in session['outputs']:
            return jsonify({'success': False, 'error': 'No EDL output available'}), 400
        
        edl_file_path = session['outputs']['edl']['path']
        
        # Get additional attachments
        additional_attachments = []
        if request.json.get('include_txt', False) and 'txt' in session['outputs']:
            additional_attachments.append(session['outputs']['txt']['path'])
        
        if request.json.get('include_pdf', False) and 'pdf' in session['outputs']:
            additional_attachments.append(session['outputs']['pdf']['path'])
        
        # Send email
        result = email_service.send_edl(
            recipient_email=recipient_email,
            edl_file_path=edl_file_path,
            subject=request.json.get('subject', 'EDL File from Retro Transcription Tool'),
            body=request.json.get('body', 'Please find attached the EDL file generated from your recording.'),
            additional_attachments=additional_attachments
        )
        
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Failed to send email')}), 500
        
        # Store email result in session
        session['email_sent'] = result
        
        return jsonify({
            'success': True,
            'email_result': result
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/session-info/<session_id>', methods=['GET'])
def session_info(session_id):
    """
    Get information about a session
    """
    try:
        # Check if session exists
        if session_id not in sessions:
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        session = sessions[session_id]
        
        # Prepare safe session info (exclude file paths)
        safe_info = {
            'session_id': session_id,
            'timestamp': session['timestamp'],
            'status': session['status'],
            'parameters': session['parameters']
        }
        
        if 'transcription' in session and session['transcription'].get('success', False):
            safe_info['segments_count'] = len(session['transcription']['segments'])
            safe_info['full_transcript'] = session['transcription']['full_transcript']
        
        if 'up_sots' in session:
            safe_info['up_sots_count'] = len(session['up_sots'])
            safe_info['up_sots'] = session['up_sots']
        
        if 'outputs' in session:
            safe_info['available_formats'] = list(session['outputs'].keys())
        
        return jsonify({
            'success': True,
            'session_info': safe_info
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/process', methods=['POST'])
def process_audio():
    """
    Process audio file and return transcription
    This is a simplified endpoint that combines upload and transcription
    """
    try:
        # Check if file is in request
        if 'audio' not in request.files:
            return jsonify({'success': False, 'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # Check if filename is empty
        if audio_file.filename == '':
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        
        # Save audio file
        audio_data = audio_file.read()
        file_path = audio_processor.save_audio_file(audio_data)
        
        # Transcribe audio
        result = audio_processor.transcribe_audio(file_path)
        
        if not result['success']:
            return jsonify({'success': False, 'error': result.get('error', 'Transcription failed')}), 500
        
        # Get parameters from request or use defaults
        max_upsots = int(request.form.get('max_upsots', 10))
        sensitivity = int(request.form.get('sensitivity', 3))
        sort_by_relevance = request.form.get('sort_by_relevance', 'false').lower() == 'true'
        
        # Get up-sots
        up_sots = audio_processor.get_up_sots(
            result['segments'],
            max_count=max_upsots,
            sensitivity=sensitivity,
            sort_by_relevance=sort_by_relevance
        )
        
        return jsonify({
            'success': True,
            'segments_count': len(result['segments']),
            'up_sots_count': len(up_sots),
            'up_sots': up_sots,
            'full_transcript': result['full_transcript']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@transcription_bp.route('/get-available-microphones', methods=['GET'])
def get_available_microphones():
    """
    Get list of available microphones
    This is a mock endpoint that returns sample microphone data
    """
    try:
        # In a real implementation, this would use system APIs to get actual microphone devices
        # For demo purposes, return mock data
        microphones = [
            {
                'id': 'default',
                'label': 'Default Microphone',
                'isDefault': True
            },
            {
                'id': 'mic-1',
                'label': 'Built-in Microphone',
                'isDefault': False
            },
            {
                'id': 'mic-2',
                'label': 'External USB Microphone',
                'isDefault': False
            },
            {
                'id': 'mic-3',
                'label': 'Headset Microphone',
                'isDefault': False
            }
        ]
        
        return jsonify({
            'success': True,
            'microphones': microphones
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
