import os
import logging
import time
from flask import Flask, render_template, jsonify, request
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.config.from_object(Config)

# Global variables to store news articles and last fetch time
news_articles = []
last_fetch_time = None

def fetch_news(max_retries=3, initial_delay=1, topics=None, custom_search=None):
    global news_articles, last_fetch_time
    api_key = app.config['NEWS_API_KEY']
    
    # Construct the query based on user preferences
    query = 'SpaceX'
    if topics and len(topics) > 0 and topics != ['all']:
        query += f" AND ({' OR '.join(topics)})"
    if custom_search:
        query += f" AND {custom_search}"
    
    url = f"https://newsapi.org/v2/everything?q={query}&apiKey={api_key}&language=en&sortBy=publishedAt"
    
    logging.info(f"Fetching news with URL: {url}")
    
    for attempt in range(max_retries):
        try:
            logging.info(f"Attempting to fetch news (attempt {attempt + 1}/{max_retries})")
            response = requests.get(url)
            logging.info(f"API Response Status Code: {response.status_code}")
            
            data = response.json()
            logging.info(f"API Response Data: {data}")
            
            if data['status'] == 'ok':
                news_articles = data['articles']
                last_fetch_time = datetime.now()
                logging.info(f"Successfully fetched {len(news_articles)} articles at {last_fetch_time}")
                return
            else:
                logging.error(f"Error fetching news: {data.get('message', 'Unknown error')}")
                logging.error(f"Full API response: {data}")
        except requests.exceptions.RequestException as e:
            logging.error(f"Request exception while fetching news: {str(e)}")
        except Exception as e:
            logging.error(f"Unexpected exception while fetching news: {str(e)}")
        
        if attempt < max_retries - 1:
            delay = initial_delay * (2 ** attempt)
            logging.info(f"Retrying in {delay} seconds...")
            time.sleep(delay)
    
    logging.error("Failed to fetch news after all retries")

# Schedule news fetching
scheduler = BackgroundScheduler()
scheduler.add_job(func=fetch_news, trigger="interval", hours=1)
scheduler.start()

# Fetch news immediately on startup
fetch_news()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/news')
def get_news():
    return jsonify(news_articles)

@app.route('/api/preferences', methods=['POST'])
def set_preferences():
    topics = request.json.get('topics', [])
    custom_search = request.json.get('customSearch', '')
    fetch_news(topics=topics, custom_search=custom_search)
    return jsonify({'status': 'success', 'message': 'Preferences updated and news fetched'})

@app.route('/status')
def get_status():
    return jsonify({
        'last_fetch_time': last_fetch_time.isoformat() if last_fetch_time else None,
        'articles_count': len(news_articles)
    })

@app.route('/fetch_news')
def manual_fetch_news():
    fetch_news()
    return jsonify({'status': 'success', 'message': 'News fetch initiated'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
