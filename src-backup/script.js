// Tauri API - 安全初始化
let invoke, listen, sendNotification;

async function initializeTauriAPI() {
    try {
        // Tauri v2 API structure
        if (window.__TAURI__) {
            const { invoke: tauriInvoke } = window.__TAURI__.core;
            const { listen: tauriListen } = window.__TAURI__.event;
            const { sendNotification: tauriSendNotification } =
                window.__TAURI__.notification;

            invoke = tauriInvoke;
            listen = tauriListen;
            sendNotification = tauriSendNotification;
            return true;
        }

        // Fallback for older versions or different setups
        if (window.__TAURI_IPC__) {
            invoke = window.__TAURI_IPC__;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Tauri API initialization error:', error);
        return false;
    }
}

// 等待Tauri API初始化
async function waitForTauri() {
    return new Promise(async (resolve) => {
        if (await initializeTauriAPI()) {
            resolve();
            return;
        }

        const checkInterval = setInterval(async () => {
            if (await initializeTauriAPI()) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        // 超时保护
        setTimeout(() => {
            clearInterval(checkInterval);
            console.error('Tauri API初始化超时');
            resolve();
        }, 5000);
    });
}

// 默认分类规则配置
const DEFAULT_CONFIG = {
    categories: {
        "图片": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".raw", ".heic"],
        "视频": [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".ts", ".mts"],
        "音频": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a", ".opus", ".aiff"],
        "文档": [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".pages", ".epub", ".mobi"],
        "表格": [".xls", ".xlsx", ".csv", ".ods", ".numbers"],
        "演示文稿": [".ppt", ".pptx", ".odp", ".key"],
        "压缩包": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".dmg", ".iso"],
        "程序": [".exe", ".msi", ".app", ".deb", ".rpm", ".pkg", ".dmg", ".appimage"],
        "代码": [".js", ".html", ".css", ".py", ".java", ".cpp", ".c", ".php", ".rb", ".go", ".rs", ".swift", ".kt"],
        "字体": [".ttf", ".otf", ".woff", ".woff2", ".eot"],
        "其他": []
    }
};

// 全局状态
let isMonitoring = false;
let currentConfig = null;
let currentSubscription = null;
let stats = {
    filesOrganized: 0,
    lastOrganized: null,
    monitoringSince: null,
};



// 设置事件监听器
function setupEventListeners() {
    // 监听系统托盘事件
    listen('organize-files', () => {
        organizeFiles();
    });

    listen('toggle-monitoring', () => {
        toggleMonitoring();
    });
}

// 加载默认文件夹
async function loadDefaultFolder() {
    if (!invoke) {
        console.log('Tauri API未初始化，跳过加载默认文件夹');
        return;
    }

    try {
        const downloadsDir = await invoke('get_default_downloads_folder');
        document.getElementById('folder-path').value = downloadsDir;
    } catch (error) {
        console.log('无法获取默认下载文件夹:', error);
    }
}

// 选择文件夹
async function selectFolder() {
    if (!invoke) {
        addLog('❌ Tauri API未初始化');
        return;
    }

    try {
        addLog('📁 正在打开文件夹选择对话框...');
        const folder = await invoke('select_folder');

        if (folder) {
            document.getElementById('folder-path').value = folder;
            addLog(`📁 已选择文件夹: ${folder}`);
        } else {
            addLog('📁 文件夹选择已取消');
        }
    } catch (error) {
        addLog(`❌ 选择文件夹失败: ${error}`);
        console.error('选择文件夹错误:', error);
    }
}

// 整理文件
async function organizeFiles() {
    // 检查订阅状态
    if (!(await checkSubscriptionBeforeAction('文件整理'))) {
        return;
    }

    const folderPath = document.getElementById('folder-path').value.trim();

    if (!folderPath) {
        alert('请先选择文件夹');
        return;
    }

    try {
        addLog('🔄 开始整理现有文件...');
        const result = await invoke('organize_files', { folderPath });

        stats.filesOrganized += parseInt(result.match(/\\d+/)?.[0] || 0);
        stats.lastOrganized = new Date().toLocaleString();
        updateStats();

        addLog(`✅ ${result}`);

        // 发送通知
        await sendNotification({
            title: '文件整理完成',
            body: result,
        });
    } catch (error) {
        addLog(`❌ 整理失败: ${error}`);
        alert(`整理失败: ${error}`);
    }
}

// 切换监控
async function toggleMonitoring() {
    // 检查订阅状态
    if (!(await checkSubscriptionBeforeAction('文件监控'))) {
        return;
    }

    const folderPath = document.getElementById('folder-path').value.trim();

    if (!folderPath) {
        alert('请先选择文件夹');
        return;
    }

    const btn = document.getElementById('monitor-btn');
    btn.disabled = true;

    try {
        const result = await invoke('toggle_monitoring', { folderPath });

        isMonitoring = result;
        btn.textContent = isMonitoring ? '⏹️ 停止监控' : '🔍 开始监控';

        if (isMonitoring) {
            stats.monitoringSince = new Date().toLocaleString();
            addLog('🔍 开始监控新文件...');
        } else {
            stats.monitoringSince = null;
            addLog('⏹️ 已停止监控');
        }

        updateStats();
    } catch (error) {
        addLog(`❌ 切换监控失败: ${error}`);
        alert(`操作失败: ${error}`);
    } finally {
        btn.disabled = false;
    }
}

// 加载配置
async function loadConfig() {
    if (!invoke) {
        console.log('Tauri API未初始化，使用默认配置');
        currentConfig = DEFAULT_CONFIG;
        return;
    }

    try {
        currentConfig = await invoke('get_config');
        // 如果后端返回的配置为空或不完整，使用默认配置
        if (!currentConfig || !currentConfig.categories) {
            currentConfig = DEFAULT_CONFIG;
            addLog('使用默认分类规则');
        }
    } catch (error) {
        addLog(`❌ 加载配置失败，使用默认配置: ${error}`);
        currentConfig = DEFAULT_CONFIG;
    }
}

// 保存配置
async function saveConfig() {
    if (!currentConfig) return;

    try {
        await invoke('save_config', { config: currentConfig });
        addLog('✅ 配置已保存');
    } catch (error) {
        addLog(`❌ 保存配置失败: ${error}`);
    }
}

// 显示分类规则
async function showCategories() {
    if (!currentConfig) await loadConfig();

    const container = document.getElementById('categories');
    container.innerHTML = '';

    for (const [category, extensions] of Object.entries(currentConfig.categories)) {
        if (extensions.length > 0) {
            const card = document.createElement('div');
            card.className = 'rule-card';
            card.innerHTML = `
                <div class="rule-card-header">${category}</div>
                <div class="rule-extensions">${extensions.join(', ')}</div>
            `;
            container.appendChild(card);
        }
    }
}

// 显示配置管理界面
async function showConfigManager() {
    const section = document.getElementById('config-section');

    if (section.style.display === 'none') {
        await loadConfigCategories();
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

// 加载配置分类
async function loadConfigCategories() {
    if (!currentConfig) await loadConfig();

    const container = document.getElementById('config-categories');
    container.innerHTML = '';

    for (const [category, extensions] of Object.entries(currentConfig.categories)) {
        if (category !== '其他') {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'rule-item';

            const extensionTags = extensions
                .map(ext => `
                    <span class="extension-tag">
                        ${ext}
                        <button class="remove-ext-btn" onclick="removeExtension('${category}', '${ext}')" title="删除">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </span>
                `).join('');

            categoryDiv.innerHTML = `
                <div class="rule-item-header">
                    <h4>${category}</h4>
                    <button class="delete-category-btn" onclick="deleteCategory('${category}')" title="删除分类">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        删除分类
                    </button>
                </div>
                <div class="extensions-list">
                    ${extensionTags}
                </div>
                <div class="add-extension-form">
                    <input type="text" placeholder="添加扩展名 (如: .mp4)" id="ext-input-${category}" class="extension-input">
                    <button class="add-extension-btn" onclick="addExtension('${category}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        添加
                    </button>
                </div>
            `;

            container.appendChild(categoryDiv);
        }
    }
}

// 添加新分类
async function addNewCategory() {
    const name = document.getElementById('new-category-name').value.trim();
    const extensionsStr = document
        .getElementById('new-category-extensions')
        .value.trim();

    if (!name) {
        alert('请输入分类名称');
        return;
    }

    if (!currentConfig) await loadConfig();

    // 检查分类名称是否已存在
    if (currentConfig.categories[name]) {
        alert('该分类名称已存在，请使用其他名称');
        return;
    }

    // 处理扩展名
    let extensions = [];
    if (extensionsStr) {
        extensions = extensionsStr.split(',').map(ext => {
            ext = ext.trim();
            // 确保扩展名以点开头
            if (ext && !ext.startsWith('.')) {
                ext = '.' + ext;
            }
            return ext;
        }).filter(ext => ext.length > 1); // 过滤掉空的或只有点的扩展名
    }

    currentConfig.categories[name] = extensions;
    await saveConfig();

    document.getElementById('new-category-name').value = '';
    document.getElementById('new-category-extensions').value = '';

    await loadConfigCategories();
    await showCategories(); // 同时更新查看规则页面
    addLog(`✅ 成功添加分类: ${name}，包含 ${extensions.length} 个扩展名`);
}

// 删除分类
async function deleteCategory(categoryName) {
    if (!confirm(`确定要删除分类 "${categoryName}" 吗？`)) {
        return;
    }

    if (!currentConfig) await loadConfig();

    delete currentConfig.categories[categoryName];
    await saveConfig();

    await loadConfigCategories();
    await showCategories(); // 同时更新查看规则页面
    addLog(`✅ 成功删除分类: ${categoryName}`);
}

// 添加扩展名
async function addExtension(categoryName) {
    const input = document.getElementById(`ext-input-${categoryName}`);
    const extension = input.value.trim();

    if (!extension) {
        alert('请输入扩展名');
        return;
    }

    if (!currentConfig) await loadConfig();

    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;

    // 验证扩展名格式
    if (normalizedExt.length < 2 || !/^\.[\w]+$/.test(normalizedExt)) {
        alert('请输入有效的扩展名格式 (如: .mp4)');
        return;
    }

    if (!currentConfig.categories[categoryName].includes(normalizedExt)) {
        currentConfig.categories[categoryName].push(normalizedExt);
        await saveConfig();

        input.value = '';
        await loadConfigCategories();
        await showCategories(); // 同时更新查看规则页面
        addLog(`✅ 向分类 ${categoryName} 添加扩展名: ${normalizedExt}`);
    } else {
        alert('该扩展名已存在');
    }
}

// 移除扩展名
async function removeExtension(categoryName, extension) {
    if (!currentConfig) await loadConfig();

    const index = currentConfig.categories[categoryName].indexOf(extension);
    if (index > -1) {
        currentConfig.categories[categoryName].splice(index, 1);
        await saveConfig();

        await loadConfigCategories();
        await showCategories(); // 同时更新查看规则页面
        addLog(`✅ 从分类 ${categoryName} 移除扩展名: ${extension}`);
    }
}

// 导出配置
async function exportConfig() {
    if (!currentConfig) await loadConfig();

    const dataStr = JSON.stringify(currentConfig, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'file_organizer_config.json';
    link.click();

    addLog('✅ 配置已导出');
}

// 导入配置
function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const config = JSON.parse(text);

            currentConfig = config;
            await saveConfig();

            await loadConfigCategories();
            addLog('✅ 成功导入配置');
        } catch (error) {
            alert(`导入配置失败: ${error.message}`);
        }
    };

    input.click();
}

// 重置配置
async function resetConfig() {
    if (!confirm('确定要重置为默认配置吗？这将删除所有自定义分类规则。')) {
        return;
    }

    // 使用默认配置
    currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    await saveConfig();

    await loadConfigCategories();
    await showCategories(); // 同时更新查看规则页面
    addLog('✅ 已重置为默认配置');
}

// 订阅相关函数

// 加载订阅状态
async function loadSubscriptionStatus() {
    if (!invoke) {
        console.log('Tauri API未初始化，跳过加载订阅状态');
        return;
    }

    try {
        currentSubscription = await invoke('get_subscription_status');
        updateSubscriptionUI();
        addLog(JSON.stringify(currentSubscription));
    } catch (error) {
        addLog(`❌ 加载订阅状态失败: ${error}`);
    }
}

// 更新订阅界面
function updateSubscriptionUI() {
    const container = document.getElementById('subscription-info');

    if (!currentSubscription) {
        container.innerHTML = '<p>加载订阅信息失败</p>';
        return;
    }

    let statusHtml = '';

    if (currentSubscription.status === 'Trial') {
        const daysRemaining = Math.max(
            0,
            Math.floor(
                (new Date(currentSubscription.trial_start_date).getTime() +
                    3 * 24 * 60 * 60 * 1000 -
                    Date.now()) /
                (24 * 60 * 60 * 1000)
            )
        );

        statusHtml = `
            <div class="subscription-card trial">
                <div class="subscription-status">🎁 试用期</div>
                <div class="subscription-details">
                    剩余 ${daysRemaining} 天试用时间
                </div>
            </div>
        `;

        if (daysRemaining <= 1) {
            statusHtml += `
                <div class="trial-warning">
                    ⚠️ 试用期即将结束，请及时订阅以继续使用所有功能
                </div>
            `;
        }

        statusHtml += createPricingPlans();
    } else if (currentSubscription.status === 'Active') {
        const endDate = new Date(currentSubscription.subscription_end_date);
        const daysRemaining = Math.max(
            0,
            Math.floor((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        );

        statusHtml = `
            <div class="subscription-card">
                <div class="subscription-status">✨ 订阅激活</div>
                <div class="subscription-details">
                    ${currentSubscription.plan === 'Monthly' ? '月度' : '年度'
            }订阅 · 剩余 ${daysRemaining} 天
                </div>
                <button class="btn btn-danger" onclick="cancelSubscription()">取消订阅</button>
            </div>
        `;
    } else if (
        currentSubscription.status === 'Expired' ||
        currentSubscription.status === 'Cancelled'
    ) {
        statusHtml = `
            <div class="subscription-card expired">
                <div class="subscription-status">❌ 订阅已过期</div>
                <div class="subscription-details">
                    请重新订阅以继续使用
                </div>
            </div>
            <div class="expired-warning">
                订阅已过期，部分功能将无法使用。请重新订阅以恢复完整功能。
            </div>
        `;

        statusHtml += createPricingPlans();
    }

    container.innerHTML = statusHtml;
}

// 创建定价方案
function createPricingPlans() {
    return `
        <div class="pricing-plans">
            <div class="pricing-card">
                <div class="plan-name">月度订阅</div>
                <div class="plan-price">$1.99</div>
                <div class="plan-period">每月</div>
                <ul class="plan-features">
                    <li>无限制文件整理</li>
                    <li>实时文件监控</li>
                    <li>自定义分类规则</li>
                    <li>技术支持</li>
                </ul>
                <button class="subscribe-btn" onclick="subscribe('monthly')">通过App Store订阅</button>
            </div>
            
            <div class="pricing-card recommended">
                <div class="plan-name">年度订阅</div>
                <div class="plan-price">$19.99</div>
                <div class="plan-period">每年 (节省 $4.89)</div>
                <ul class="plan-features">
                    <li>无限制文件整理</li>
                    <li>实时文件监控</li>
                    <li>自定义分类规则</li>
                    <li>优先技术支持</li>
                    <li>未来功能抢先体验</li>
                </ul>
                <button class="subscribe-btn" onclick="subscribe('yearly')">通过App Store订阅</button>
            </div>
        </div>
        
        <div class="restore-purchases">
            <button class="btn btn-secondary" onclick="restorePurchases()">恢复购买</button>
            <p class="restore-hint">如果您之前已经购买过，点击此按钮恢复您的订阅</p>
        </div>
    `;
}

// 订阅
async function subscribe(plan) {
    try {
        // 获取Apple产品信息
        const products = await invoke('get_apple_products');
        const productId =
            plan === 'monthly'
                ? products.monthly.product_id
                : products.yearly.product_id;

        addLog(`🛒 启动Apple订阅购买: ${productId}`);

        // 启动App Store内购流程
        const result = await invoke('start_apple_purchase', {
            product_id: productId,
        });
        addLog(`✅ ${result}`);

        // 注意：实际的购买完成会通过StoreKit回调处理
        // 这里我们可以显示一个等待购买完成的提示
        showPurchaseWaitingDialog(plan);
    } catch (error) {
        addLog(`❌ 启动订阅失败: ${error}`);
        alert(`启动订阅失败: ${error}`);
    }
}

// 显示购买等待对话框
function showPurchaseWaitingDialog(plan) {
    const dialog = document.createElement('div');
    dialog.className = 'purchase-waiting-dialog';
    dialog.innerHTML = `
    <div class="dialog-content">
      <h3>正在处理购买</h3>
      <p>请在App Store对话框中完成${plan === 'monthly' ? '月度' : '年度'
        }订阅购买。</p>
      <div class="dialog-buttons">
        <button onclick="closePurchaseDialog()" class="btn">取消</button>
        <button onclick="checkPurchaseStatus()" class="btn btn-primary">检查购买状态</button>
      </div>
    </div>
  `;

    document.body.appendChild(dialog);
}

// 关闭购买对话框
function closePurchaseDialog() {
    const dialog = document.querySelector('.purchase-waiting-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 检查购买状态
async function checkPurchaseStatus() {
    try {
        addLog('🔍 检查购买状态...');

        // 获取本地收据数据
        const receiptData = await invoke('get_local_receipt_data');

        if (receiptData) {
            // 验证收据
            const result = await invoke('verify_apple_receipt', {
                receipt_data: receiptData,
            });
            addLog(`✅ ${result}`);

            // 重新加载订阅状态
            await loadSubscriptionStatus();

            // 关闭对话框
            closePurchaseDialog();

            alert('订阅激活成功！感谢您的支持。');
        } else {
            addLog('⚠️ 未找到购买收据，请确保购买已完成');
            alert('未找到购买收据，请确保购买已完成');
        }
    } catch (error) {
        addLog(`❌ 检查购买状态失败: ${error}`);
        alert(`检查购买状态失败: ${error}`);
    }
}

// 恢复购买
async function restorePurchases() {
    try {
        addLog('🔄 恢复Apple购买...');

        const result = await invoke('restore_apple_purchases');
        addLog(`✅ ${result}`);

        // 显示恢复等待提示
        alert('正在恢复购买，请稍候...');

        // 等待一段时间后检查状态
        setTimeout(async () => {
            await checkPurchaseStatus();
        }, 3000);
    } catch (error) {
        addLog(`❌ 恢复购买失败: ${error}`);
        alert(`恢复购买失败: ${error}`);
    }
}

// 取消订阅
async function cancelSubscription() {
    if (!confirm('确定要取消订阅吗？取消后将在当前订阅期结束后停止服务。')) {
        return;
    }

    try {
        const result = await invoke('cancel_subscription');
        addLog(`✅ ${result}`);

        // 重新加载订阅状态
        await loadSubscriptionStatus();
    } catch (error) {
        addLog(`❌ 取消订阅失败: ${error}`);
        alert(`取消订阅失败: ${error}`);
    }
}

// 检查订阅状态
async function checkSubscriptionBeforeAction(actionName) {
    try {
        const canUse = await invoke('can_use_app');
        if (!canUse) {
            alert(`${actionName}功能需要有效订阅。请先订阅后再使用。`);
            return false;
        }
        return true;
    } catch (error) {
        addLog(`❌ 检查订阅状态失败: ${error}`);
        return false;
    }
}

// 更新统计信息
function updateStats() {
    document.getElementById('files-count').textContent = stats.filesOrganized;
    document.getElementById('last-organized').textContent =
        stats.lastOrganized || '未开始';
    document.getElementById('monitoring-status').textContent = isMonitoring
        ? '监控中'
        : '已停止';
}
// 导航系统
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.dataset.view;

            // 更新导航状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // 切换视图
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`${targetView}-view`).classList.add('active');
        });
    });
}

// 标签页系统
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // 更新标签状态
            tabBtns.forEach(tab => tab.classList.remove('active'));
            btn.classList.add('active');

            // 切换面板
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// 清空日志
function clearLogs() {
    const logs = document.getElementById('logs');
    logs.innerHTML = '<div class="log-entry"><span class="log-time">[清空]</span><span class="log-message">日志已清空</span></div>';
}

// 更新日志格式
function addLog(message) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${message}</span>
    `;

    logs.appendChild(entry);
    logs.scrollTop = logs.scrollHeight;

    // 保持最新100条日志
    while (logs.children.length > 100) {
        logs.removeChild(logs.firstChild);
    }
}

// 在DOMContentLoaded事件中初始化导航
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化导航和标签页
    initializeNavigation();
    initializeTabs();

    // 等待Tauri API初始化
    await waitForTauri();

    if (!invoke) {
        addLog('Tauri API初始化失败');
        // 即使API初始化失败，也要加载默认配置
        currentConfig = DEFAULT_CONFIG;
    } else {
        await loadSubscriptionStatus();
        const canUse = await invoke('can_use_app');
        if (canUse) {
            addLog('应用已启动');
        } else {
            addLog('试用期已结束，请订阅后继续使用');
        }
    }

    await loadConfig();
    await loadDefaultFolder();

    // 初始化显示分类规则
    await showCategories();
    await loadConfigCategories();

    // 设置键盘事件
    setupKeyboardEvents();

    // 显示配置统计
    showCategoryStats();

    if (invoke) {
        setupEventListeners();
    }
});

// 添加键盘事件支持
function setupKeyboardEvents() {
    // 为新分类表单添加回车键支持
    document.getElementById('new-category-name')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('new-category-extensions').focus();
        }
    });

    document.getElementById('new-category-extensions')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addNewCategory();
        }
    });

    // 为扩展名输入框添加回车键支持
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('extension-input')) {
            const categoryName = e.target.id.replace('ext-input-', '');
            addExtension(categoryName);
        }
    });
}

// 显示分类规则统计信息
function showCategoryStats() {
    if (!currentConfig) return;

    const totalCategories = Object.keys(currentConfig.categories).length - 1; // 排除"其他"分类
    const totalExtensions = Object.values(currentConfig.categories)
        .reduce((total, extensions) => total + extensions.length, 0);

    addLog(`📊 当前配置: ${totalCategories} 个分类，${totalExtensions} 个文件扩展名`);
}