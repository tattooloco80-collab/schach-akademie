from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, db, auth
from datetime import datetime
import uuid
import os

app = Flask(__name__)
CORS(app)

# Firebase Init
try:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": "schach-akademie",
        "private_key_id": "7b7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj\nMzEfYyjiWA4/4ggMVuJl7dPn4TNT6MF2F3c1d9hL+FFLcHr8q0wCJLcJ1QQ9Bdrg\nX9x2dR0RGxaFvNGq/DXMIP3EfjzCODAHw0nMpqwcq+W2X/Fc3nqZ7qHp3dLR8R3R\nxE7Gr0RzP8sRfVCqV5RIL1Yw2HMjqH2vTLGzSsaW3LcHJZj8f9Mj8HLHXC6e3NMh\nzPLKLKn9WZx8vV6R7vZ2KqK9L5TQp0r0q0R8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K\n5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6AgMBAAECggEBALCKipKUhKqj\njzuBr5Lk3HkWyGT7q+P5KlwPIXkfNISxPGvkRwhLtcnIx0K5Y0VxIlZ7eFVlVvCR\no6I2J+K3e7T9B0Lk5K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K\n5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6Q8K5H6\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6QECQQDj1VZ7G9b3mW8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8\nQ8K5H6Q8K5H6Q8K5H6Q8K5H6Q8ECQQDQq8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8\nQECQQCj1VZ7G9b3mW8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P7q8P\n-----END PRIVATE KEY-----\n",
        "client_email": "firebase-adminsdk-h2pxn@schach-akademie.iam.gserviceaccount.com",
        "client_id": "117894621234567890",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "database_url": "https://schach-akademie-default-rtdb.firebaseio.com"
    })
    firebase_admin.initialize_app(cred, {'databaseURL': 'https://schach-akademie-default-rtdb.firebaseio.com'})
except:
    pass

# ============ HEALTH CHECK ============
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

# ============ LOGIN ============
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    try:
        data = request.get_json()
        nickname = data.get('nickname', '').strip()

        if not nickname:
            return jsonify({'error': 'Nickname required'}), 400

        uid = str(uuid.uuid4())

        db.reference(f'players/{uid}').set({
            'nickname': nickname,
            'status': 'online',
            'createdAt': int(datetime.now().timestamp() * 1000),
            'lastActive': int(datetime.now().timestamp() * 1000),
            'elo': 1200,
            'wins': 0,
            'losses': 0,
            'draws': 0
        })

        return jsonify({
            'success': True,
            'uid': uid,
            'nickname': nickname,
            'elo': 1200
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ GET LOBBY PLAYERS ============
@app.route('/api/lobby/players', methods=['GET'])
def api_get_players():
    try:
        uid = request.args.get('uid', '')
        if not uid:
            return jsonify({'error': 'UID required'}), 400

        ref = db.reference('players')
        players_data = ref.get()

        players = []
        if players_data:
            for player_uid, player_info in players_data.items():
                if player_info.get('status') == 'online' and player_uid != uid:
                    players.append({
                        'uid': player_uid,
                        'nickname': player_info.get('nickname', ''),
                        'elo': player_info.get('elo', 1200),
                        'status': 'online'
                    })

        return jsonify({'players': players[::-1]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ SEND CHALLENGE ============
@app.route('/api/challenge/send', methods=['POST'])
def api_send_challenge():
    try:
        data = request.get_json()
        from_uid = data.get('from', '')
        from_nick = data.get('fromNickname', '')
        to_uid = data.get('to', '')
        to_nick = data.get('toNickname', '')

        if not from_uid or not to_uid:
            return jsonify({'error': 'from and to required'}), 400

        opponent = db.reference(f'players/{to_uid}').get()
        if not opponent:
            return jsonify({'error': 'Opponent not found'}), 404

        challenge_id = str(uuid.uuid4())

        db.reference(f'challenges/{challenge_id}').set({
            'from': from_uid,
            'fromNickname': from_nick,
            'to': to_uid,
            'toNickname': to_nick,
            'status': 'pending',
            'createdAt': int(datetime.now().timestamp() * 1000),
            'expiresAt': int((datetime.now().timestamp() + 300) * 1000)
        })

        return jsonify({'success': True, 'challengeId': challenge_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ GET CHALLENGES ============
@app.route('/api/challenge/list', methods=['GET'])
def api_get_challenges():
    try:
        uid = request.args.get('uid', '')
        if not uid:
            return jsonify({'error': 'UID required'}), 400

        ref = db.reference('challenges')
        challenges_data = ref.get()

        challenges = []
        if challenges_data:
            for c_id, c_info in challenges_data.items():
                if c_info.get('to') == uid and c_info.get('status') == 'pending':
                    challenges.append({
                        'id': c_id,
                        'from': c_info.get('from', ''),
                        'fromNickname': c_info.get('fromNickname', ''),
                        'to': c_info.get('to', ''),
                        'toNickname': c_info.get('toNickname', ''),
                        'status': 'pending'
                    })

        return jsonify({'challenges': challenges})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ ACCEPT CHALLENGE ============
@app.route('/api/challenge/accept', methods=['POST'])
def api_accept_challenge():
    try:
        data = request.get_json()
        challenge_id = data.get('challengeId', '')
        uid = data.get('uid', '')

        if not challenge_id or not uid:
            return jsonify({'error': 'challengeId and uid required'}), 400

        challenge = db.reference(f'challenges/{challenge_id}').get()
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        if challenge.get('status') != 'pending':
            return jsonify({'error': 'Challenge already processed'}), 400

        game_id = str(uuid.uuid4())

        db.reference(f'games/{game_id}').set({
            'white': challenge.get('from'),
            'whiteNickname': challenge.get('fromNickname'),
            'black': uid,
            'blackNickname': challenge.get('toNickname'),
            'status': 'active',
            'moves': [],
            'createdAt': int(datetime.now().timestamp() * 1000),
            'lastMove': int(datetime.now().timestamp() * 1000)
        })

        db.reference(f'challenges/{challenge_id}').update({
            'status': 'accepted',
            'gameId': game_id,
            'acceptedAt': int(datetime.now().timestamp() * 1000)
        })

        return jsonify({'success': True, 'gameId': game_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ DECLINE CHALLENGE ============
@app.route('/api/challenge/decline', methods=['POST'])
def api_decline_challenge():
    try:
        data = request.get_json()
        challenge_id = data.get('challengeId', '')

        if not challenge_id:
            return jsonify({'error': 'challengeId required'}), 400

        db.reference(f'challenges/{challenge_id}').update({'status': 'declined'})

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ GET GAME STATE ============
@app.route('/api/game/state', methods=['GET'])
def api_game_state():
    try:
        game_id = request.args.get('gameId', '')
        if not game_id:
            return jsonify({'error': 'gameId required'}), 400

        game = db.reference(f'games/{game_id}').get()
        if not game:
            return jsonify({'error': 'Game not found'}), 404

        return jsonify({'game': game})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ SEND MOVE ============
@app.route('/api/game/move', methods=['POST'])
def api_send_move():
    try:
        data = request.get_json()
        game_id = data.get('gameId', '')
        uid = data.get('uid', '')
        move = data.get('move', '')

        if not game_id or not uid or not move:
            return jsonify({'error': 'gameId, uid, move required'}), 400

        game = db.reference(f'games/{game_id}').get()
        if not game:
            return jsonify({'error': 'Game not found'}), 404

        moves = game.get('moves', [])
        moves.append({
            'move': move,
            'by': uid,
            'timestamp': int(datetime.now().timestamp() * 1000)
        })

        db.reference(f'games/{game_id}').update({
            'moves': moves,
            'lastMove': int(datetime.now().timestamp() * 1000)
        })

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ END GAME ============
@app.route('/api/game/end', methods=['POST'])
def api_end_game():
    try:
        data = request.get_json()
        game_id = data.get('gameId', '')
        result = data.get('result', {})

        if not game_id or not result:
            return jsonify({'error': 'gameId and result required'}), 400

        game = db.reference(f'games/{game_id}').get()
        if not game:
            return jsonify({'error': 'Game not found'}), 404

        db.reference(f'games/{game_id}').update({
            'status': 'ended',
            'result': result.get('type'),
            'winner': result.get('winner'),
            'endedAt': int(datetime.now().timestamp() * 1000)
        })

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"✅ Schach-Akademie Backend läuft!")
    print(f"🌐 http://localhost:{port}")
    print(f"💚 Health: http://localhost:{port}/health")
    print(f"📱 App kann jetzt Multiplayer nutzen!")
    app.run(host='0.0.0.0', port=port, debug=False)
