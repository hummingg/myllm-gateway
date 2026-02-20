// MyLLM Gateway Web UI
const API_BASE = '';
const _charts = {};

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
    initCharts(stats);
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

function initCharts(stats) {
  // 请求趋势图 - 使用真实小时数据
  const requestsCtx = document.getElementById('requestsChart');
  if (requestsCtx) {
    if (_charts.requests) { _charts.requests.destroy(); }
    const hourlyData = Array.from({length: 24}, (_, i) => (stats?.hourlyRequests?.[i] || 0));
    _charts.requests = new Chart(requestsCtx, {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: '请求数',
          data: hourlyData,
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

  // 模型分布图 - 使用真实模型分布数据
  const modelsCtx = document.getElementById('modelsChart');
  if (modelsCtx) {
    if (_charts.models) { _charts.models.destroy(); }
    const modelDist = stats?.modelDistribution || {};
    const modelEntries = Object.entries(modelDist).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const labels = modelEntries.length ? modelEntries.map(e => e[0]) : ['暂无数据'];
    const data = modelEntries.length ? modelEntries.map(e => e[1]) : [1];
    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#64748b', '#ec4899', '#14b8a6'];
    _charts.models = new Chart(modelsCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length)
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
    const data = await fetch(`${API_BASE}/models`).then(r => r.json());
    const tbody = document.querySelector('#models-table tbody');

    tbody.innerHTML = data.models?.map(m => `
      <tr>
        <td>${escapeHtml(m.name || m.id)}</td>
        <td>${escapeHtml(m.provider)}</td>
        <td>${m.tags?.map(t => `<span class="tag tag-blue">${escapeHtml(t)}</span>`).join(' ') || '-'}</td>
        <td>${(m.contextWindow / 1000).toFixed(0)}K</td>
        <td><small>$${m.costPer1KInput || 0}</small><br><small>$${m.costPer1KOutput || 0}</small></td>
        <td>
          <label class="switch">
            <input type="checkbox" ${m.enabled ? 'checked' : ''} data-model-id="${escapeHtml(m.id)}" data-action="toggle">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" data-model-id="${escapeHtml(m.id)}" data-action="edit">编辑</button>
          <button class="btn btn-sm btn-danger" data-model-id="${escapeHtml(m.id)}" data-action="delete">删除</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="placeholder">暂无模型数据</td></tr>';
  } catch (err) {
    console.error('加载模型失败:', err);
  }
}

async function toggleModel(modelId, enabled) {
  try {
    await fetch(`${API_BASE}/models/${encodeURIComponent(modelId)}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
  } catch (err) {
    console.error('切换模型状态失败:', err);
  }
}

let _editingModelId = null;

function openModelModal(model) {
  _editingModelId = model ? model.id : null;
  document.getElementById('model-modal-title').textContent = model ? '编辑模型' : '添加模型';

  document.getElementById('model-id').value = model?.id || '';
  document.getElementById('model-id').disabled = !!model;
  document.getElementById('model-name').value = model?.name || '';
  document.getElementById('model-provider').value = model?.provider || 'anthropic';
  document.getElementById('model-context').value = model?.contextWindow || 4096;
  document.getElementById('model-cost-input').value = model?.costPer1KInput || 0;
  document.getElementById('model-cost-output').value = model?.costPer1KOutput || 0;
  document.getElementById('model-tags').value = model?.tags?.join(', ') || '';
  document.getElementById('model-priority').value = model?.priority || 1;
  document.getElementById('model-enabled').checked = model ? model.enabled : true;

  document.querySelectorAll('input[name="capability"]').forEach(cb => {
    cb.checked = model ? (model.capabilities?.includes(cb.value) || false) : cb.value === 'text';
  });

  document.getElementById('model-modal').classList.add('open');
}

function closeModelModal() {
  document.getElementById('model-modal').classList.remove('open');
  _editingModelId = null;
}

function showAddModelModal() {
  openModelModal(null);
}

async function editModel(modelId) {
  try {
    const data = await fetch(`${API_BASE}/models`).then(r => r.json());
    const model = data.models?.find(m => m.id === modelId);
    if (model) openModelModal(model);
  } catch (err) {
    alert('加载模型失败: ' + err.message);
  }
}

async function deleteModel(modelId) {
  if (!confirm(`确定要删除模型 "${modelId}" 吗？`)) return;
  try {
    const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadModels();
    } else {
      alert('删除失败: ' + (data.error || '未知错误'));
    }
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

async function saveModel() {
  const id = document.getElementById('model-id').value.trim();
  const name = document.getElementById('model-name').value.trim();
  const provider = document.getElementById('model-provider').value;

  if (!id || !name || !provider) {
    alert('请填写必填字段: 模型ID、显示名称、供应商');
    return;
  }

  const capabilities = Array.from(document.querySelectorAll('input[name="capability"]:checked')).map(cb => cb.value);
  const tagsRaw = document.getElementById('model-tags').value;
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = {
    id, name, provider,
    contextWindow: parseInt(document.getElementById('model-context').value) || 4096,
    costPer1KInput: parseFloat(document.getElementById('model-cost-input').value) || 0,
    costPer1KOutput: parseFloat(document.getElementById('model-cost-output').value) || 0,
    capabilities,
    tags,
    priority: parseInt(document.getElementById('model-priority').value) || 1,
    enabled: document.getElementById('model-enabled').checked
  };

  try {
    const url = _editingModelId
      ? `${API_BASE}/models/${encodeURIComponent(_editingModelId)}`
      : `${API_BASE}/models`;
    const method = _editingModelId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeModelModal();
      loadModels();
    } else {
      alert('保存失败: ' + (data.error || '未知错误'));
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
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
          <button class="btn btn-sm btn-secondary" data-action="edit-route">编辑</button>
          <button class="btn btn-sm btn-danger" data-action="delete-route">删除</button>
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
let _playgroundModels = [];

function renderModelOptions(filter) {
  const select = document.getElementById('playground-model');
  const q = (filter || '').toLowerCase();
  const filtered = q
    ? _playgroundModels.filter(m =>
        (m.name || m.id).toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
      )
    : _playgroundModels;
  select.innerHTML = '<option value="auto">自动路由</option>' +
    filtered.map(m => `<option value="${m.provider}::${m.id}">${m.name || m.id} (${m.provider})</option>`).join('');
}

async function loadPlayground() {
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    _playgroundModels = health.models || [];
    renderModelOptions('');

    document.getElementById('playground-model-search').addEventListener('input', e => {
      renderModelOptions(e.target.value);
    });
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

    outputContent.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;

    outputMeta.innerHTML = `
      <span class="tag tag-blue">${data.model || ''}</span>
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
    const url = date ? `/logs?date=${date}` : '/logs';
    const res = await fetch(url);
    const data = await res.json();
    let logs = data.logs || [];

    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter(log =>
        (log.model || '').toLowerCase().includes(q) ||
        (log.provider || '').toLowerCase().includes(q) ||
        (log.id || '').toLowerCase().includes(q)
      );
    }

    const container = document.getElementById('logs-list');
    if (logs.length === 0) {
      container.innerHTML = '<div class="placeholder">暂无日志记录</div>';
      return;
    }
    container.innerHTML = logs.map(log => `
      <div class="log-item" data-id="${escapeHtml(log.id)}" data-date="${date}">
        <div class="log-header">
          <span class="log-model">${escapeHtml(log.model || '')}</span>
          <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
        </div>
        <div class="log-meta">
          <span>Provider: ${escapeHtml(log.provider || '')}</span>
          <span>Latency: ${log.latency != null ? log.latency + 'ms' : '-'}</span>
          <span>Status: ${escapeHtml(log.status || '')}</span>
          <span>ID: ${escapeHtml(log.id || '')}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('加载日志失败:', err);
  }
}

async function openLogDetail(id, date) {
  const url = date ? `/logs/${id}?date=${date}` : `/logs/${id}`;
  const modal = document.getElementById('log-modal');
  document.getElementById('modal-title').textContent = `请求详情 — ${id}`;
  document.getElementById('modal-request').textContent = '加载中...';
  document.getElementById('modal-response').textContent = '加载中...';
  modal.classList.add('open');

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Not found');
    const log = await res.json();
    document.getElementById('modal-request').textContent =
      JSON.stringify(log.request, null, 2);
    document.getElementById('modal-response').textContent =
      JSON.stringify(log.response, null, 2);
  } catch (err) {
    document.getElementById('modal-request').textContent = '加载失败';
    document.getElementById('modal-response').textContent = String(err);
  }
}

function closeLogModal(event) {
  if (event && event.target !== document.getElementById('log-modal')) return;
  document.getElementById('log-modal').classList.remove('open');
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

  // 按钮绑定
  document.getElementById('btn-refresh').addEventListener('click', refreshData);
  document.getElementById('btn-add-model').addEventListener('click', showAddModelModal);
  document.getElementById('btn-add-route').addEventListener('click', showAddRouteModal);
  document.getElementById('btn-clear-cache').addEventListener('click', clearCache);
  document.getElementById('btn-send-playground').addEventListener('click', sendPlaygroundRequest);
  document.getElementById('btn-search-logs').addEventListener('click', searchLogs);

  // 模型弹窗
  document.getElementById('model-modal-close').addEventListener('click', closeModelModal);
  document.getElementById('model-modal-cancel').addEventListener('click', closeModelModal);
  document.getElementById('model-modal-save').addEventListener('click', saveModel);
  document.getElementById('model-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModelModal();
  });

  // 日志列表事件委托
  document.getElementById('logs-list').addEventListener('click', e => {
    const item = e.target.closest('.log-item');
    if (item) openLogDetail(item.dataset.id, item.dataset.date);
  });

  // 模型表格事件委托
  document.getElementById('models-table').addEventListener('change', e => {
    if (e.target.dataset.action === 'toggle') {
      toggleModel(e.target.dataset.modelId, e.target.checked);
    }
  });
  document.getElementById('models-table').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const modelId = btn.dataset.modelId;
    if (btn.dataset.action === 'edit') editModel(modelId);
    if (btn.dataset.action === 'delete') deleteModel(modelId);
  });

  // 弹窗关闭
  document.getElementById('log-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('log-modal').classList.remove('open');
  });
});
