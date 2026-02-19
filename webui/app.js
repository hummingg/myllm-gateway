// MyLLM Gateway Web UI
const API_BASE = '';

// 页面切换
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = item.dataset.page;
      
      // 更新导航状态
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      // 切换页面
      pages.forEach(p => p.classList.remove('active'));
      document.getElementById(targetPage).classList.add('active');
      
      // 更新标题
      document.getElementById('page-title').textContent = item.textContent.trim();
      
      // 加载页面数据
      loadPageData(targetPage);
    });
  });
}

// 加载页面数据
async function loadPageData(page) {
  switch(page) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'models':
      await loadModels();
      break;
    case 'routing':
      await loadRouting();
      break;
    case 'cache':
      await loadCache();
      break;
    case 'playground':
      await loadPlayground();
      break;
    case 'logs':
      await loadLogs();
      break;
    case 'settings':
      await loadSettings();
      break;
  }
}

// ============ 仪表盘 ============
async function loadDashboard() {
  try {
    // 加载统计数据
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    const stats = await fetch(`${API_BASE}/stats`).then(r => r.json());
    const cacheStats = await fetch(`${API_BASE}/cache/stats`).then(r => r.json());
    
    document.getElementById('stat-requests').textContent = stats.requests24h?.toLocaleString() || '-';
    document.getElementById('stat-cost').textContent = '$' + (stats.cost24h || 0).toFixed(2);
    document.getElementById('stat-latency').textContent = Math.round(stats.averageLatency24h || 0) + 'ms';
    document.getElementById('stat-cache').textContent = cacheStats.enabled 
      ? Math.round((cacheStats.totalAccesses / (cacheStats.totalAccesses + stats.requests24h || 1)) * 100) + '%'
      : 'N/A';
    
    // 加载免费额度
    loadQuotaList(health);
    
    // 初始化图表
    initCharts();
  } catch (err) {
    console.error('加载仪表盘失败:', err);
  }
}

function loadQuotaList(health) {
  const container = document.getElementById('quota-list');
  if (!health.freeTier) {
    container.innerHTML = '<div class="placeholder">暂无免费额度数据</div>';
    return;
  }
  
  container.innerHTML = health.freeTier.models?.map(m => `
    <div class="quota-item">
      <div class="quota-header">
        <span class="quota-model">${m.model}</span>
        <span class="quota-remaining">${m.remaining?.toLocaleString()} tokens</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min((m.remaining / 1000000) * 100, 100)}%"></div>
      </div>
    </div>
  `).join('') || '<div class="placeholder">暂无可用免费额度</div>';
}

function initCharts() {
  // 请求趋势图
  const requestsCtx = document.getElementById('requestsChart');
  if (requestsCtx) {
    new Chart(requestsCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: '请求数',
          data: Array.from({length: 24}, () => Math.floor(Math.random() * 100)),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#334155' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
  
  // 模型分布图
  const modelsCtx = document.getElementById('modelsChart');
  if (modelsCtx) {
    new Chart(modelsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Kimi', 'Claude', 'GPT-4', '其他'],
        datasets: [{
          data: [40, 30, 20, 10],
          backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8' } }
        }
      }
    });
  }
}

// ============ 模型管理 ============
async function loadModels() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    const tbody = document.querySelector('#models-table tbody');
    
    tbody.innerHTML = health.models?.map(m => `
      <tr>
        <td>${m.name || m.id}</td>
        <td>${m.provider}</td>
        <td>${m.tags?.map(t => `<span class="tag tag-blue">${t}</span>`).join(' ') || '-'}</td>
        <td>${(m.contextWindow / 1000).toFixed(0)}K</td>
        <td>$${m.costPer1KInput || 0}</td>
        <td>
          <label class="switch">
            <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleModel('${m.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editModel('${m.id}')">编辑</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="placeholder">暂无模型数据</td></tr>';
  } catch (err) {
    console.error('加载模型失败:', err);
  }
}

function toggleModel(modelId, enabled) {
  // TODO: 调用 API 切换模型状态
  console.log('切换模型状态:', modelId, enabled);
}

function editModel(modelId) {
  // TODO: 打开编辑弹窗
  console.log('编辑模型:', modelId);
}

function showAddModelModal() {
  alert('添加模型功能开发中...');
}

// ============ 路由配置 ============
async function loadRouting() {
  try {
    // 加载关键词路由规则
    const routes = [
      { keywords: ['谷歌', 'YouTube', 'Twitter'], tags: ['国外部署'], priority: 100 },
      { keywords: ['百度', '微博', '抖音'], tags: ['国内部署'], priority: 100 },
      { keywords: ['高速', '快速'], tags: ['高速'], priority: 90 }
    ];
    
    const container = document.getElementById('routes-list');
    container.innerHTML = routes.map(r => `
      <div class="route-item">
        <div>
          <div class="route-keywords">
            ${r.keywords.map(k => `<span class="tag tag-orange">${k}</span>`).join('')}
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
            → ${r.tags.map(t => `<span class="tag tag-blue">${t}</span>`).join(' ')}
          </div>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary" onclick="editRoute()">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRoute()">删除</button>
        </div>
      </div>
    `).join('');
    
    // 加载场景配置
    document.getElementById('scenario-config').innerHTML = `
      <div class="settings-section">
        <p>场景优先级配置开发中...</p>
      </div>
    `;
  } catch (err) {
    console.error('加载路由配置失败:', err);
  }
}

function showAddRouteModal() {
  alert('添加路由规则功能开发中...');
}

function editRoute() {
  alert('编辑功能开发中...');
}

function deleteRoute() {
  if (confirm('确定要删除这条规则吗？')) {
    alert('删除功能开发中...');
  }
}

// ============ 缓存管理 ============
async function loadCache() {
  try {
    const stats = await fetch(`${API_BASE}/cache/stats`).then(r => r.json());
    
    document.getElementById('cache-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-value">${stats.enabled ? '✅' : '❌'}</span>
          <span class="stat-label">缓存状态</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-value">${stats.totalEntries}</span>
          <span class="stat-label">缓存条目</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <span class="stat-value">${stats.totalAccesses}</span>
          <span class="stat-label">命中次数</span>
        </div>
      </div>
    `;
    
    document.getElementById('cache-entries').innerHTML = `
      <div class="placeholder">缓存条目列表开发中...</div>
    `;
  } catch (err) {
    console.error('加载缓存失败:', err);
  }
}

async function clearCache() {
  if (!confirm('确定要清空所有缓存吗？')) return;
  
  try {
    const res = await fetch(`${API_BASE}/cache/clear`, { method: 'POST' });
    const data = await res.json();
    alert(data.message || '缓存已清空');
    loadCache();
  } catch (err) {
    alert('清空缓存失败: ' + err.message);
  }
}

// ============ 测试工具 ============
async function loadPlayground() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    const select = document.getElementById('playground-model');
    
    // 保留 auto 选项，添加模型选项
    select.innerHTML = '<option value="auto">自动路由</option>' +
      health.models?.map(m => `<option value="${m.id}">${m.name || m.id}</option>`).join('');
  } catch (err) {
    console.error('加载模型列表失败:', err);
  }
}

async function sendPlaygroundRequest() {
  const model = document.getElementById('playground-model').value;
  const system = document.getElementById('playground-system').value;
  const user = document.getElementById('playground-user').value;
  const temperature = document.getElementById('playground-temp').value;
  const maxTokens = document.getElementById('playground-maxtokens').value;
  
  if (!user.trim()) {
    alert('请输入用户消息');
    return;
  }
  
  const outputContent = document.getElementById('output-content');
  const outputMeta = document.getElementById('output-meta');
  
  outputContent.innerHTML = '<div class="placeholder">请求中...</div>';
  outputMeta.innerHTML = '';
  
  const startTime = Date.now();
  
  try {
    const messages = [];
    if (system.trim()) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });
    
    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: parseFloat(temperature),
        max_tokens: parseInt(maxTokens),
        stream: false
      })
    });
    
    const data = await res.json();
    const latency = Date.now() - startTime;
    
    if (data.error) {
      outputContent.innerHTML = `<div style="color: var(--danger);">错误: ${data.error.message}</div>`;
      return;
    }
    
    const content = data.choices?.[0]?.message?.content || '无响应内容';
    outputContent.innerHTML = `<div>${escapeHtml(content)}</div>`;
    
    outputMeta.innerHTML = `
      <span class="tag tag-blue">${data.model}</span>
      <span class="tag tag-green">${latency}ms</span>
      ${data.cached ? '<span class="tag tag-orange">缓存</span>' : ''}
    `;
  } catch (err) {
    outputContent.innerHTML = `<div style="color: var(--danger);">请求失败: ${err.message}</div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ 日志查询 ============
async function loadLogs() {
  // 设置今天为默认日期
  document.getElementById('log-date').valueAsDate = new Date();
  await searchLogs();
}

async function searchLogs() {
  const date = document.getElementById('log-date').value;
  const search = document.getElementById('log-search').value;
  
  try {
    // 模拟日志数据
    const logs = [
      { id: 'abc123', model: 'moonshot-v1-8k', provider: 'moonshot', latency: 1200, time: new Date().toISOString() },
      { id: 'def456', model: 'claude-3-5-sonnet', provider: 'anthropic', latency: 2300, time: new Date().toISOString() }
    ];
    
    const container = document.getElementById('logs-list');
    container.innerHTML = logs.map(log => `
      <div class="log-item">
        <div class="log-header">
          <span class="log-model">${log.model}</span>
          <span class="log-time">${new Date(log.time).toLocaleString()}</span>
        </div>
        <div class="log-meta">
          <span>Provider: ${log.provider}</span>
          <span>Latency: ${log.latency}ms</span>
          <span>ID: ${log.id}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载日志失败:', err);
  }
}

// ============ 系统设置 ============
async function loadSettings() {
  document.getElementById('env-list').innerHTML = `
    <div class="placeholder">环境变量列表开发中...</div>
  `;
  
  document.getElementById('system-info').innerHTML = `
    <p><strong>版本:</strong> v1.0.0</p>
    <p><strong>Node.js:</strong> ${navigator.userAgent}</p>
    <p><strong>运行时间:</strong> <span id="uptime">计算中...</span></p>
  `;
}

// ============ 通用功能 ============
function refreshData() {
  const activePage = document.querySelector('.page.active').id;
  loadPageData(activePage);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboard();
});
