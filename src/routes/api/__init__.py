"""
Initialize API routes for audio library
"""

from flask import Blueprint
from src.routes.api.audio_library import audio_library_bp
from src.routes.api.transcription import transcription_bp

# Create main API blueprint
api_bp = Blueprint('api', __name__)

# Register sub-blueprints
api_bp.register_blueprint(audio_library_bp, url_prefix='/audio')
api_bp.register_blueprint(transcription_bp, url_prefix='/transcription')
