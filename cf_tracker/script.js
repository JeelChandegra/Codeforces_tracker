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
const currentStreakElement = document.getElementById('currentStreak');
const longestStreakElement = document.getElementById('longestStreak');
const loadingElement = document.getElementById('loading');
const weakTopicsList = document.getElementById('weakTopicsList');
const nextLevelList = document.getElementById('nextLevelList');
const popularList = document.getElementById('popularList');
const mixedList = document.getElementById('mixedList');
const similarList = document.getElementById('similarList');
const contestPrepList = document.getElementById('contestPrepList');
const topicMasteryContainer = document.getElementById('topicMasteryContainer');
const randomizerDifficulty = document.getElementById('randomizerDifficulty');
const randomizerTag = document.getElementById('randomizerTag');
const randomizeBtn = document.getElementById('randomizeBtn');
const randomProblemDisplay = document.getElementById('randomProblemDisplay');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const themeToggle = document.getElementById('themeToggle');

// Store problems data
let allProblems = [];
let userSubmissions = new Set();
let userSubmissionsData = []; // Store full submission data with timestamps
let ratingChart = null;
let tagsChart = null;
let currentPage = 1;
const problemsPerPage = 10;

// Show/hide loading spinner
const toggleLoading = (show) => {
    loadingElement.style.display = show ? 'flex' : 'none';
};

// Dark theme toggle
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '☀️ Light Mode';
    }
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

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
        if (typeof rating === 'number' && rating > maxRating) maxRating = rating;

        // Count tags
        problem.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // Update max rating
    maxRatingElement.textContent = maxRating || '0';

    // Update most solved tag
    const mostSolvedTag = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])[0];
    mostSolvedTagElement.textContent = mostSolvedTag ? mostSolvedTag[0] : '-';

    // Update rating chart
    if (ratingChart) {
        const ratings = Object.keys(ratingCounts).sort((a, b) => a - b);
        ratingChart.data.labels = ratings;
        ratingChart.data.datasets[0].data = ratings.map(r => ratingCounts[r]);
        ratingChart.update();
    }

    // Update tags chart (top 8 tags)
    if (tagsChart) {
        const topTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
        tagsChart.data.labels = topTags.map(t => t[0]);
        tagsChart.data.datasets[0].data = topTags.map(t => t[1]);
        tagsChart.update();
    }
}

// Fetch problems from Codeforces API
async function fetchProblems() {
    try {
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();
        if (data.status === 'OK') {
            allProblems = data.result.problems;
            const statistics = data.result.problemStatistics;
            
            // Merge solve counts into problems
            allProblems.forEach((problem, index) => {
                if (statistics[index]) {
                    problem.solvedCount = statistics[index].solvedCount;
                }
            });
            
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
            userSubmissionsData = [];
            data.result.forEach(submission => {
                if (submission.verdict === 'OK') {
                    const problemKey = `${submission.problem.contestId}-${submission.problem.index}`;
                    if (!userSubmissions.has(problemKey)) {
                        userSubmissions.add(problemKey);
                        userSubmissionsData.push({
                            problemKey,
                            problem: submission.problem,
                            timestamp: submission.creationTimeSeconds
                        });
                    }
                }
            });
            // Sort by timestamp (most recent first)
            userSubmissionsData.sort((a, b) => b.timestamp - a.timestamp);
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
    
    // Also populate randomizer tag filter
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        randomizerTag.appendChild(option);
    });
}

// Generate problem recommendations
function generateRecommendations(problems) {
    // Analyze tag statistics
    const tagStats = {};
    
    // First, count all available problems per tag
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

    // Then count solved problems per tag
    problems.forEach(problem => {
        problem.tags.forEach(tag => {
            if (tagStats[tag]) {
                tagStats[tag].solved++;
            }
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

    // Find next level problems - use average rating for more balanced progression
    const ratedProblems = problems.filter(p => p.rating);
    let avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 800;
    
    // Calculate percentile (top 25% of solved ratings)
    const sortedRatings = ratedProblems.map(p => p.rating).sort((a, b) => b - a);
    const topPercentileRating = sortedRatings.length > 4 
        ? sortedRatings[Math.floor(sortedRatings.length * 0.25)]
        : (sortedRatings[0] || avgRating);
    
    // Next level is average of (average rating and top percentile) + 50-100
    const baseRating = Math.round((avgRating + topPercentileRating) / 2);
    const nextLevelRating = baseRating > 0 ? baseRating + 50 : 800;

    // Generate recommendations
    try {
        displayWeakTopicsRecommendations(weakTopics, problems);
        displayNextLevelRecommendations(nextLevelRating, problems);
        displayPopularRecommendations(problems);
        displayMixedRecommendations(problems);
        displaySimilarRecommendations(problems);
        displayContestPrepRecommendations(problems);
        displayTopicMastery(tagStats, problems);
        calculateStreaks();
    } catch (error) {
        console.error('Error generating recommendations:', error);
    }
}

function displayWeakTopicsRecommendations(weakTopics, solvedProblems) {
    weakTopicsList.innerHTML = '';

    // Calculate user's comfortable rating range
    const ratedProblems = solvedProblems.filter(p => p.rating);
    const avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 800;

    weakTopics.forEach(topic => {
        // Find unsolved problems for this topic within user's rating range (±200)
        const recommendations = allProblems
            .filter(problem => {
                const problemKey = `${problem.contestId}-${problem.index}`;
                return problem.tags.includes(topic.tag) && 
                       !userSubmissions.has(problemKey) &&
                       problem.rating &&
                       problem.rating >= avgRating - 200 &&
                       problem.rating <= avgRating + 200;
            })
            .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0)) // Sort by popularity
            .slice(0, 4); // Increased from 2 to 4

        recommendations.forEach(problem => {
            const solveRate = ((topic.solved / topic.total) * 100).toFixed(1);
            const card = createRecommendationCard(
                problem,
                `Weak topic: ${topic.tag} (${solveRate}% solved) - Practice to improve!`
            );
            weakTopicsList.appendChild(card);
        });
    });

    if (weakTopicsList.children.length === 0) {
        weakTopicsList.innerHTML = '<p class="no-recommendations">Keep solving problems to get personalized recommendations!</p>';
    }
}

function displayNextLevelRecommendations(targetRating, solvedProblems) {
    nextLevelList.innerHTML = '';

    // Get user's favorite tags (top 5 most solved)
    const tagCounts = {};
    solvedProblems.forEach(problem => {
        problem.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    const favoriteTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(t => t[0]);

    // Calculate average for context
    const ratedProblems = solvedProblems.filter(p => p.rating);
    const avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 800;

    // Find problems in a gradual progression: target range, +50 range, +100 range
    const ratingRanges = [
        { min: targetRating - 50, max: targetRating + 50 },
        { min: targetRating + 50, max: targetRating + 100 },
        { min: targetRating + 100, max: targetRating + 150 }
    ];
    let recommendations = [];

    // First try: with favorite tags
    ratingRanges.forEach(range => {
        const problems = allProblems
            .filter(problem => {
                const problemKey = `${problem.contestId}-${problem.index}`;
                return problem.rating >= range.min &&
                       problem.rating <= range.max &&
                       !userSubmissions.has(problemKey) &&
                       favoriteTags.length > 0 &&
                       problem.tags.some(tag => favoriteTags.includes(tag));
            })
            .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
            .slice(0, 2);
        recommendations.push(...problems);
    });

    // If not enough, get any unsolved problems in those ranges
    if (recommendations.length < 4) {
        ratingRanges.forEach(range => {
            const problems = allProblems
                .filter(problem => {
                    const problemKey = `${problem.contestId}-${problem.index}`;
                    return problem.rating >= range.min &&
                           problem.rating <= range.max &&
                           !userSubmissions.has(problemKey) &&
                           !recommendations.some(r => r.contestId === problem.contestId && r.index === problem.index);
                })
                .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
                .slice(0, 3);
            recommendations.push(...problems);
        });
    }

    recommendations.slice(0, 6).forEach(problem => {
        const ratingDiff = problem.rating - avgRating;
        const card = createRecommendationCard(
            problem,
            `Next step: +${ratingDiff} from your average (${avgRating})`
        );
        nextLevelList.appendChild(card);
    });

    if (nextLevelList.children.length === 0) {
        nextLevelList.innerHTML = '<p class="no-recommendations">No next level problems found. Try solving more problems first!</p>';
    }
}

// Display popular unsolved problems
function displayPopularRecommendations(solvedProblems) {
    popularList.innerHTML = '';

    // Get user's rating range
    const ratedProblems = solvedProblems.filter(p => p.rating);
    const avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 1000;

    // Find popular unsolved problems in user's rating range
    const recommendations = allProblems
        .filter(problem => {
            const problemKey = `${problem.contestId}-${problem.index}`;
            return !userSubmissions.has(problemKey) &&
                   problem.rating &&
                   problem.rating >= avgRating - 100 &&
                   problem.rating <= avgRating + 100;
        })
        .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
        .slice(0, 6);

    recommendations.forEach(problem => {
        const card = createRecommendationCard(
            problem,
            `Popular problem at your level - ${(problem.solvedCount || 0).toLocaleString()} solves`
        );
        popularList.appendChild(card);
    });

    if (popularList.children.length === 0) {
        popularList.innerHTML = '<p class="no-recommendations">No popular problems found at your level!</p>';
    }
}

// Display mixed practice recommendations
function displayMixedRecommendations(solvedProblems) {
    mixedList.innerHTML = '';

    // Get user statistics
    const ratedProblems = solvedProblems.filter(p => p.rating);
    const avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 1000;

    // Get solved tags
    const solvedTags = new Set();
    solvedProblems.forEach(problem => {
        problem.tags.forEach(tag => solvedTags.add(tag));
    });

    // Find diverse problems (different tags, various ratings)
    const recommendations = [];
    const usedTags = new Set();
    
    // Get problems across different rating ranges (more flexible)
    const ratingRanges = [
        { min: avgRating - 150, max: avgRating - 50 },
        { min: avgRating - 50, max: avgRating + 50 },
        { min: avgRating + 50, max: avgRating + 150 },
        { min: avgRating + 150, max: avgRating + 250 }
    ];
    
    // First pass: try to get problems with new tags
    ratingRanges.forEach(range => {
        const problem = allProblems.find(p => {
            const problemKey = `${p.contestId}-${p.index}`;
            const hasNewTag = p.tags.some(tag => !usedTags.has(tag));
            return !userSubmissions.has(problemKey) &&
                   p.rating >= range.min &&
                   p.rating <= range.max &&
                   hasNewTag;
        });
        
        if (problem) {
            recommendations.push(problem);
            problem.tags.forEach(tag => usedTags.add(tag));
        }
    });

    // Second pass: if not enough, add any unsolved problems in those ranges
    if (recommendations.length < 4) {
        ratingRanges.forEach(range => {
            const problems = allProblems
                .filter(p => {
                    const problemKey = `${p.contestId}-${p.index}`;
                    return !userSubmissions.has(problemKey) &&
                           p.rating >= range.min &&
                           p.rating <= range.max &&
                           !recommendations.some(r => r.contestId === p.contestId && r.index === p.index);
                })
                .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
                .slice(0, 2);
            recommendations.push(...problems);
        });
    }

    recommendations.slice(0, 6).forEach(problem => {
        const newTags = problem.tags.filter(tag => !solvedTags.has(tag));
        const reason = newTags.length > 0 
            ? `Explore new topics: ${newTags.slice(0, 2).join(', ')}`
            : `Mixed practice at ${problem.rating} rating`;
        
        const card = createRecommendationCard(problem, reason);
        mixedList.appendChild(card);
    });

    if (mixedList.children.length === 0) {
        mixedList.innerHTML = '<p class="no-recommendations">Keep solving to unlock mixed recommendations!</p>';
    }
}

// Display similar problems to recently solved ones
function displaySimilarRecommendations(solvedProblems) {
    similarList.innerHTML = '';

    if (userSubmissionsData.length === 0) {
        similarList.innerHTML = '<p class="no-recommendations">Solve some problems first!</p>';
        return;
    }

    // Get last 5 solved problems
    const recentProblems = userSubmissionsData.slice(0, 5).map(s => s.problem);
    
    // Find problems with similar tags
    const recommendations = [];
    recentProblems.forEach(recentProblem => {
        const similar = allProblems
            .filter(problem => {
                const problemKey = `${problem.contestId}-${problem.index}`;
                const sharedTags = problem.tags.filter(tag => recentProblem.tags.includes(tag));
                return !userSubmissions.has(problemKey) &&
                       sharedTags.length >= 2 && // At least 2 shared tags
                       Math.abs((problem.rating || 0) - (recentProblem.rating || 0)) <= 200;
            })
            .sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
            .slice(0, 1);
        recommendations.push(...similar);
    });

    // Remove duplicates and limit
    const uniqueRecommendations = Array.from(new Set(recommendations.map(p => `${p.contestId}-${p.index}`)))
        .map(key => recommendations.find(p => `${p.contestId}-${p.index}` === key))
        .slice(0, 6);

    uniqueRecommendations.forEach(problem => {
        const card = createRecommendationCard(
            problem,
            `Similar to recently solved problems`
        );
        similarList.appendChild(card);
    });

    if (similarList.children.length === 0) {
        similarList.innerHTML = '<p class="no-recommendations">No similar problems found!</p>';
    }
}

// Display contest preparation recommendations
function displayContestPrepRecommendations(solvedProblems) {
    contestPrepList.innerHTML = '';

    const ratedProblems = solvedProblems.filter(p => p.rating);
    const avgRating = ratedProblems.length > 0 
        ? Math.round(ratedProblems.reduce((sum, p) => sum + p.rating, 0) / ratedProblems.length)
        : 1000;

    // Contest-like set: mix of problems at different difficulties
    const contestRatings = [
        avgRating - 200,  // Warm up
        avgRating - 100,  // Easy
        avgRating,        // Medium
        avgRating + 100,  // Hard
        avgRating + 200   // Very Hard
    ];

    const recommendations = [];
    contestRatings.forEach(rating => {
        const problem = allProblems.find(p => {
            const problemKey = `${p.contestId}-${p.index}`;
            return !userSubmissions.has(problemKey) &&
                   p.rating >= rating - 50 &&
                   p.rating <= rating + 50;
        });
        if (problem) recommendations.push(problem);
    });

    recommendations.slice(0, 5).forEach((problem, index) => {
        const difficulty = ['Warm-up', 'Easy', 'Medium', 'Hard', 'Very Hard'][index];
        const card = createRecommendationCard(
            problem,
            `Contest ${difficulty} problem`
        );
        contestPrepList.appendChild(card);
    });

    if (contestPrepList.children.length === 0) {
        contestPrepList.innerHTML = '<p class="no-recommendations">Not enough problems for contest prep!</p>';
    }
}

// Calculate practice streaks
function calculateStreaks() {
    if (userSubmissionsData.length === 0) {
        currentStreakElement.textContent = '0 days';
        longestStreakElement.textContent = '0 days';
        return;
    }

    // Get unique days of solving
    const solveDays = userSubmissionsData.map(s => {
        const date = new Date(s.timestamp * 1000);
        return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
    });
    const uniqueDays = Array.from(new Set(solveDays)).sort((a, b) => b - a);

    // Calculate current streak
    const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    let currentStreak = 0;
    
    for (let i = 0; i < uniqueDays.length; i++) {
        const expectedDay = today - i;
        if (uniqueDays[i] === expectedDay || uniqueDays[i] === expectedDay - 1) {
            currentStreak++;
        } else {
            break;
        }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let tempStreak = 1;
    
    for (let i = 1; i < uniqueDays.length; i++) {
        if (uniqueDays[i-1] - uniqueDays[i] === 1) {
            tempStreak++;
            longestStreak = Math.max(longestStreak, tempStreak);
        } else {
            tempStreak = 1;
        }
    }

    currentStreakElement.textContent = `${currentStreak} day${currentStreak !== 1 ? 's' : ''}`;
    longestStreakElement.textContent = `${longestStreak} day${longestStreak !== 1 ? 's' : ''}`;
}

// Display topic mastery progress
function displayTopicMastery(tagStats, solvedProblems) {
    topicMasteryContainer.innerHTML = '';

    // Get top 8 tags by total problems
    const topTopics = Object.entries(tagStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8);

    topTopics.forEach(([tag, stats]) => {
        const masteryCard = document.createElement('div');
        masteryCard.className = 'mastery-card';
        
        const progress = Math.min(100, (stats.solved / stats.total) * 100);
        const masteryLevel = progress >= 80 ? 'Master' : progress >= 50 ? 'Intermediate' : 'Beginner';
        
        masteryCard.innerHTML = `
            <h4>${tag}</h4>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <p class="mastery-stats">${stats.solved}/${stats.total} problems (${progress.toFixed(1)}%)</p>
            <span class="mastery-level ${masteryLevel.toLowerCase()}">${masteryLevel}</span>
        `;
        
        topicMasteryContainer.appendChild(masteryCard);
    });

    if (topTopics.length === 0) {
        topicMasteryContainer.innerHTML = '<p class="no-recommendations">Start solving to track your topic mastery!</p>';
    }
}

// Randomizer functionality
randomizeBtn.addEventListener('click', () => {
    const selectedDifficulty = randomizerDifficulty.value;
    const selectedTag = randomizerTag.value;
    
    let candidateProblems = allProblems.filter(problem => {
        const problemKey = `${problem.contestId}-${problem.index}`;
        const difficultyMatch = selectedDifficulty === 'any' || problem.rating === parseInt(selectedDifficulty);
        const tagMatch = selectedTag === 'any' || problem.tags.includes(selectedTag);
        return !userSubmissions.has(problemKey) && difficultyMatch && tagMatch;
    });

    if (candidateProblems.length === 0) {
        randomProblemDisplay.innerHTML = '<p class="no-recommendations">No problems found with selected criteria!</p>';
        return;
    }

    const randomProblem = candidateProblems[Math.floor(Math.random() * candidateProblems.length)];
    
    randomProblemDisplay.innerHTML = '';
    const card = createRecommendationCard(
        randomProblem,
        `Random ${selectedDifficulty !== 'any' ? selectedDifficulty + ' rated' : ''} ${selectedTag !== 'any' ? selectedTag : ''} problem`
    );
    randomProblemDisplay.appendChild(card);
});

// Display problems in the UI with pagination
let allFilteredProblems = [];

function displayProblems(problems) {
    allFilteredProblems = problems;
    currentPage = 1;
    renderProblemsPage();
}

function renderProblemsPage() {
    problemsList.innerHTML = '';
    
    const totalPages = Math.ceil(allFilteredProblems.length / problemsPerPage);
    const startIndex = (currentPage - 1) * problemsPerPage;
    const endIndex = startIndex + problemsPerPage;
    const problemsToShow = allFilteredProblems.slice(startIndex, endIndex);
    
    problemsToShow.forEach(problem => {
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
    
    // Update pagination controls
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    
    if (allFilteredProblems.length === 0) {
        problemsList.innerHTML = '<p class="no-recommendations">No solved problems to display</p>';
        pageInfo.textContent = 'Page 0 of 0';
    }
}

// Pagination event listeners
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderProblemsPage();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allFilteredProblems.length / problemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProblemsPage();
    }
});

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
    try {
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
    } catch (error) {
        console.error('Error filtering problems:', error);
        alert('Error processing data. Please refresh and try again.');
    }
}

// Update statistics
function updateStats(problems) {
    totalSolvedElement.textContent = problems.length;
    
    // Calculate average rating excluding unrated problems
    const ratedProblems = problems.filter(p => p.rating);
    const totalRating = ratedProblems.reduce((sum, problem) => sum + problem.rating, 0);
    const avgRating = ratedProblems.length ? Math.round(totalRating / ratedProblems.length) : 0;
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
    try {
        const success = await fetchUserSubmissions(username);
        if (success) {
            filterAndDisplayProblems();
        }
    } catch (error) {
        console.error('Error during search:', error);
        alert('An error occurred. Please try again.');
    } finally {
        toggleLoading(false);
    }
});

difficultyFilter.addEventListener('change', filterAndDisplayProblems);
tagFilter.addEventListener('change', filterAndDisplayProblems);

// Initialize theme and fetch problems
initTheme();
fetchProblems(); 