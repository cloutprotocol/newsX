function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function createNewsItem(article) {
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';

    const date = document.createElement('div');
    date.className = 'news-date';
    date.textContent = formatDate(article.publishedAt);
    newsItem.appendChild(date);

    const title = document.createElement('div');
    title.className = 'news-title';
    title.textContent = article.title;
    newsItem.appendChild(title);

    if (article.urlToImage) {
        const image = document.createElement('img');
        image.className = 'news-image';
        image.src = article.urlToImage;
        image.alt = article.title;
        newsItem.appendChild(image);
    }

    const description = document.createElement('div');
    description.className = 'news-description';
    description.textContent = article.description;
    newsItem.appendChild(description);

    const author = document.createElement('div');
    author.className = 'news-author';
    author.textContent = `Author: ${article.author || 'Unknown'}`;
    newsItem.appendChild(author);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const readButton = document.createElement('a');
    readButton.className = 'read-button';
    readButton.href = article.url;
    readButton.target = '_blank';
    readButton.textContent = 'Read Article';
    buttonContainer.appendChild(readButton);

    const shareButton = document.createElement('a');
    shareButton.className = 'share-button';
    shareButton.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(article.url)}`;
    shareButton.target = '_blank';
    shareButton.textContent = 'Share on 𝕏';
    buttonContainer.appendChild(shareButton);

    newsItem.appendChild(buttonContainer);

    return newsItem;
}

function showLoading() {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '<div class="loading">Loading news...</div>';
}

function showError(message) {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = `
        <div class="error">
            <p>${message}</p>
            <button onclick="retryFetch()">Retry</button>
        </div>`;
}

function getPreferences() {
    return {
        topic: localStorage.getItem('newsPreferences') || 'all',
        customSearch: localStorage.getItem('customSearch') || ''
    };
}

function setPreferences(topic, customSearch) {
    localStorage.setItem('newsPreferences', topic);
    localStorage.setItem('customSearch', customSearch);
}

function updateNewsFeed() {
    showLoading();
    const preferences = getPreferences();
    fetch('/api/news')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(articles => {
            const newsContainer = document.getElementById('news-container');
            newsContainer.innerHTML = '';

            if (articles.length === 0) {
                newsContainer.innerHTML = '<div class="no-news">No news articles available for your selected topic.</div>';
            } else {
                articles.forEach(article => {
                    const newsItem = createNewsItem(article);
                    newsContainer.appendChild(newsItem);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching news:', error);
            showError(`Failed to load news: ${error.message}. Please try again later.`);
        });
}

function updateStatus() {
    fetch('/status')
        .then(response => response.json())
        .then(status => {
            const statusElement = document.getElementById('status');
            if (status.last_fetch_time) {
                statusElement.textContent = `Last updated: ${formatDate(status.last_fetch_time)} | Articles: ${status.articles_count}`;
            } else {
                statusElement.textContent = 'No data fetched yet';
            }
        })
        .catch(error => {
            console.error('Error fetching status:', error);
            const statusElement = document.getElementById('status');
            statusElement.textContent = 'Error fetching status';
        });
}

function retryFetch() {
    fetch('/fetch_news')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateNewsFeed();
                updateStatus();
            } else {
                throw new Error('Failed to initiate news fetch');
            }
        })
        .catch(error => {
            console.error('Error retrying fetch:', error);
            showError(`Failed to retry: ${error.message}. Please try again later.`);
        });
}

function manualRefresh() {
    fetch('/fetch_news')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateNewsFeed();
                updateStatus();
            } else {
                throw new Error('Failed to initiate news fetch');
            }
        })
        .catch(error => {
            console.error('Error manual refreshing:', error);
            showError(`Failed to refresh: ${error.message}. Please try again later.`);
        });
}

function initPreferencesForm() {
    const select = document.getElementById('topic-preferences');
    const customSearch = document.getElementById('custom-search');
    const preferences = getPreferences();

    select.value = preferences.topic;
    customSearch.value = preferences.customSearch;

    function updatePreferences() {
        const selectedTopic = select.value;
        const customSearchTerm = customSearch.value;
        setPreferences(selectedTopic, customSearchTerm);
        
        fetch('/api/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topics: [selectedTopic], customSearch: customSearchTerm }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                updateNewsFeed();
                updateStatus();
            } else {
                throw new Error('Failed to update preferences');
            }
        })
        .catch(error => {
            console.error('Error updating preferences:', error);
            showError(`Failed to update preferences: ${error.message}. Please try again later.`);
        });
    }

    select.addEventListener('change', updatePreferences);
    customSearch.addEventListener('input', debounce(updatePreferences, 500));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

setInterval(() => {
    updateNewsFeed();
    updateStatus();
}, 3600000);

document.addEventListener('DOMContentLoaded', () => {
    initPreferencesForm();
    updateNewsFeed();
    updateStatus();
    document.getElementById('refresh-button').addEventListener('click', manualRefresh);
});
