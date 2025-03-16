// Cache DOM elements
const usernameInput = document.getElementById('username');
const searchBtn = document.getElementById('searchBtn');
const difficultyFilter = document.getElementById('difficultyFilter');
const tagFilter = document.getElementById('tagFilter');
const problemsList = document.getElementById('problemsList');
const totalSolvedElement = document.getElementById('totalSolved');
const avgRatingElement = document.getElementById('avgRating');
const maxRatingElement = document.getElementById('maxRating');
const mostSolvedTagElement = document.getElementById('mostSolvedTag');
const loadingElement = document.getElementById('loading');
const weakTopicsList = document.getElementById('weakTopicsList');
const nextLevelList = document.getElementById('nextLevelList');

// Store problems data
let allProblems = [];
let userSubmissions = new Set();
let ratingChart = null;
let tagsChart = null;

// Show/hide loading spinner
const toggleLoading = (show) => {
    loadingElement.style.display = show ? 'flex' : 'none';
};

// Initialize charts
function initializeCharts() {
    const ratingCtx = document.getElementById('ratingChart').getContext('2d');
    const tagsCtx = document.getElementById('tagsChart').getContext('2d');

    ratingChart = new Chart(ratingCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Problems Solved',
                data: [],
                backgroundColor: '#1a73e8',
                borderColor: '#1557b0',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    tagsChart = new Chart(tagsCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#1a73e8', '#43a047', '#fb8c00', '#e53935',
                    '#8e24aa', '#00acc1', '#3949ab', '#757575'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Update analytics
function updateAnalytics(problems) {
    // Rating distribution
    const ratingCounts = {};
    const tagCounts = {};
    let maxRating = 0;

    problems.forEach(problem => {
        // Count ratings
        const rating = problem.rating || 'Unrated';
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        if (rating > maxRating) maxRating = rating;

        // Count tags
        problem.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // Update max rating
    maxRatingElement.textContent = maxRating || 'Unrated';

    // Update most solved tag
    const mostSolvedTag = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])[0];
    mostSolvedTagElement.textContent = mostSolvedTag ? mostSolvedTag[0] : '-';

    // Update rating chart
    const ratings = Object.keys(ratingCounts).sort((a, b) => a - b);
    ratingChart.data.labels = ratings;
    ratingChart.data.datasets[0].data = ratings.map(r => ratingCounts[r]);
    ratingChart.update();

    // Update tags chart (top 8 tags)
    const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    tagsChart.data.labels = topTags.map(t => t[0]);
    tagsChart.data.datasets[0].data = topTags.map(t => t[1]);
    tagsChart.update();
}

// Fetch problems from Codeforces API
async function fetchProblems() {
    try {
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();
        if (data.status === 'OK') {
            allProblems = data.result.problems;
            populateTagFilter();
            initializeCharts();
        }
    } catch (error) {
        console.error('Error fetching problems:', error);
        alert('Error fetching problems from Codeforces API');
    }
}

// Fetch user's submissions
async function fetchUserSubmissions(username) {
    try {
        const response = await fetch(`https://codeforces.com/api/user.status?handle=${username}`);
        const data = await response.json();
        if (data.status === 'OK') {
            userSubmissions.clear();
            data.result.forEach(submission => {
                if (submission.verdict === 'OK') {
                    const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
                    userSubmissions.add(problemKey);
                }
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error fetching user submissions:', error);
        alert('Error fetching user submissions. Please check the username.');
        return false;
    }
}

// Populate tag filter dropdown
function populateTagFilter() {
    const tags = new Set();
    allProblems.forEach(problem => {
        problem.tags.forEach(tag => tags.add(tag));
    });
    
    const sortedTags = Array.from(tags).sort();
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagFilter.appendChild(option);
    });
}

// Generate problem recommendations
function generateRecommendations(problems) {
    // Analyze tag statistics
    const tagStats = {};
    allProblems.forEach(problem => {
        problem.tags.forEach(tag => {
            if (!tagStats[tag]) {
                tagStats[tag] = {
                    total: 0,
                    solved: 0
                };
            }
            tagStats[tag].total++;
        });
    });

    problems.forEach(problem => {
        problem.tags.forEach(tag => {
            tagStats[tag].solved++;
        });
    });

    // Find weak topics (low solve rate)
    const weakTopics = Object.entries(tagStats)
        .map(([tag, stats]) => ({
            tag,
            solveRate: stats.solved / stats.total,
            total: stats.total
        }))
        .filter(topic => topic.total >= 5) // Only consider tags with enough problems
        .sort((a, b) => a.solveRate - b.solveRate)
        .slice(0, 3);

    // Find next level problems
    const userMaxRating = Math.max(...problems.map(p => p.rating || 0));
    const nextLevelRating = userMaxRating + 100;

    // Generate recommendations
    displayWeakTopicsRecommendations(weakTopics);
    displayNextLevelRecommendations(nextLevelRating);
}

function displayWeakTopicsRecommendations(weakTopics) {
    weakTopicsList.innerHTML = '';

    weakTopics.forEach(topic => {
        // Find unsolved problems for this topic
        const recommendations = allProblems
            .filter(problem => {
                const problemKey = `${problem.contestId}-${problem.index}`;
                return problem.tags.includes(topic.tag) && 
                       !userSubmissions.has(problemKey);
            })
            .slice(0, 2);

        recommendations.forEach(problem => {
            const card = createRecommendationCard(
                problem,
                `This problem will help you improve in ${topic.tag}`
            );
            weakTopicsList.appendChild(card);
        });
    });

    if (weakTopicsList.children.length === 0) {
        weakTopicsList.innerHTML = '<p class="no-recommendations">Keep solving problems to get personalized recommendations!</p>';
    }
}

function displayNextLevelRecommendations(targetRating) {
    nextLevelList.innerHTML = '';

    const recommendations = allProblems
        .filter(problem => {
            const problemKey = `${problem.contestId}-${problem.index}`;
            return problem.rating === targetRating && 
                   !userSubmissions.has(problemKey);
        })
        .slice(0, 4);

    recommendations.forEach(problem => {
        const card = createRecommendationCard(
            problem,
            `This problem will help you reach the next difficulty level`
        );
        nextLevelList.appendChild(card);
    });

    if (nextLevelList.children.length === 0) {
        nextLevelList.innerHTML = '<p class="no-recommendations">No next level problems found. Try solving more problems first!</p>';
    }
}

function createRecommendationCard(problem, reason) {
    const card = document.createElement('div');
    card.className = 'recommendation-card';
    card.onclick = () => window.open(
        `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
        '_blank'
    );

    const problemInfo = document.createElement('div');
    problemInfo.className = 'problem-info';

    const title = document.createElement('h4');
    title.textContent = problem.name;

    const difficulty = document.createElement('span');
    difficulty.className = 'problem-difficulty';
    difficulty.textContent = problem.rating || 'Unrated';

    const tags = document.createElement('div');
    tags.className = 'problem-tags';
    problem.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tags.appendChild(tagSpan);
    });

    const reasonElement = document.createElement('div');
    reasonElement.className = 'recommendation-reason';
    reasonElement.textContent = reason;

    problemInfo.appendChild(title);
    problemInfo.appendChild(difficulty);
    card.appendChild(problemInfo);
    card.appendChild(tags);
    card.appendChild(reasonElement);

    return card;
}

// Filter and display problems
function filterAndDisplayProblems() {
    const selectedDifficulty = difficultyFilter.value;
    const selectedTag = tagFilter.value;
    
    const filteredProblems = allProblems.filter(problem => {
        const difficultyMatch = selectedDifficulty === 'all' || problem.rating === parseInt(selectedDifficulty);
        const tagMatch = selectedTag === 'all' || problem.tags.includes(selectedTag);
        const problemKey = `${problem.contestId}-${problem.index}`;
        const isSolved = userSubmissions.has(problemKey);
        return difficultyMatch && tagMatch && isSolved;
    });

    displayProblems(filteredProblems);
    updateStats(filteredProblems);
    updateAnalytics(filteredProblems);
    generateRecommendations(filteredProblems);
}

// Display problems in the UI
function displayProblems(problems) {
    problemsList.innerHTML = '';
    
    problems.forEach(problem => {
        const problemCard = document.createElement('div');
        problemCard.className = 'problem-card solved';
        
        const problemInfo = document.createElement('div');
        problemInfo.className = 'problem-info';
        
        const title = document.createElement('h3');
        title.innerHTML = `<a href="https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}" target="_blank">
            ${problem.name}
        </a>`;
        
        const tags = document.createElement('div');
        tags.className = 'problem-tags';
        problem.tags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.textContent = tag;
            tags.appendChild(tagSpan);
        });
        
        const difficulty = document.createElement('div');
        difficulty.className = 'problem-difficulty';
        difficulty.textContent = problem.rating || 'Unrated';
        
        problemInfo.appendChild(title);
        problemInfo.appendChild(tags);
        problemCard.appendChild(problemInfo);
        problemCard.appendChild(difficulty);
        
        problemsList.appendChild(problemCard);
    });
}

// Update statistics
function updateStats(problems) {
    totalSolvedElement.textContent = problems.length;
    
    const totalRating = problems.reduce((sum, problem) => sum + (problem.rating || 0), 0);
    const avgRating = problems.length ? Math.round(totalRating / problems.length) : 0;
    avgRatingElement.textContent = avgRating;
}

// Event listeners
searchBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    toggleLoading(true);
    const success = await fetchUserSubmissions(username);
    if (success) {
        filterAndDisplayProblems();
    }
    toggleLoading(false);
});

difficultyFilter.addEventListener('change', filterAndDisplayProblems);
tagFilter.addEventListener('change', filterAndDisplayProblems);

// Initialize
fetchProblems(); 