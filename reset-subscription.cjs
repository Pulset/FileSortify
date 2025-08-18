#!/usr/bin/env node

/**
 * 开发工具：重置订阅状态到试用期
 * 用于测试购买流程
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// 获取订阅文件路径
function getSubscriptionPath() {
    const configDir = path.join(os.homedir(), 'Library', 'Application Support', 'fileSortify');
    return path.join(configDir, 'subscription.json');
}

// 生成与Rust代码相同的加密密钥
function getEncryptionKey() {
    const hostname = os.hostname() || process.env.COMPUTERNAME || process.env.HOSTNAME || process.env.HOST || '';
    const username = os.userInfo().username || process.env.USERNAME || process.env.USER || '';

    // 模拟Rust的DefaultHasher（简化版本）
    let hash = 0;
    const input = hostname + username + 'FileSortify_v1.0_encryption_salt';

    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // 生成32字节密钥
    const key = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
        key[i] = (Math.abs(hash) >> (i % 8)) & 0xFF;
    }

    return key;
}

// 解密数据
function decryptData(encryptedData) {
    const key = getEncryptionKey();
    const decrypted = Buffer.alloc(encryptedData.length);

    for (let i = 0; i < encryptedData.length; i++) {
        const keyByte = key[i % key.length];
        decrypted[i] = encryptedData[i] ^ keyByte;
    }

    return decrypted.toString('utf8');
}

// 加密数据
function encryptData(data) {
    const key = getEncryptionKey();
    const dataBuffer = Buffer.from(data, 'utf8');
    const encrypted = Buffer.alloc(dataBuffer.length);

    for (let i = 0; i < dataBuffer.length; i++) {
        const keyByte = key[i % key.length];
        encrypted[i] = dataBuffer[i] ^ keyByte;
    }

    return encrypted;
}

// 检测文件是否加密
function isFileEncrypted(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        return false; // 能解析JSON说明未加密
    } catch {
        return true; // 无法解析说明可能已加密
    }
}

// 重置订阅状态
function resetSubscription() {
    const subscriptionPath = getSubscriptionPath();

    console.log('订阅文件路径:', subscriptionPath);

    if (!fs.existsSync(subscriptionPath)) {
        console.log('❌ 订阅文件不存在');
        return;
    }

    try {
        // 读取当前订阅数据（支持加密文件）
        let currentData;
        if (isFileEncrypted(subscriptionPath)) {
            console.log('检测到加密文件，正在解密...');
            const encryptedData = fs.readFileSync(subscriptionPath);
            const decryptedContent = decryptData(encryptedData);
            currentData = JSON.parse(decryptedContent);
        } else {
            console.log('检测到未加密文件');
            currentData = JSON.parse(fs.readFileSync(subscriptionPath, 'utf8'));
        }

        console.log('当前订阅状态:', currentData.status);
        console.log('当前套餐:', currentData.plan);

        // 重置为试用状态
        const resetData = {
            ...currentData,
            plan: "Free",
            status: "Expired",
            trial_start_date: "2025-08-10T06:49:07.518495Z",
            subscription_start_date: null,
            subscription_end_date: null,
            creem_session_id: null,
            creem_transaction_id: null,
            apple_transaction_id: null,
            apple_receipt_data: null,
            last_check_date: new Date().toISOString()
        };

        // 写入重置后的数据（加密）
        const jsonContent = JSON.stringify(resetData, null, 2);
        const encryptedData = encryptData(jsonContent);
        fs.writeFileSync(subscriptionPath, encryptedData);

        console.log('✅ 订阅状态已重置为试用期');
        console.log('新的试用开始时间:', resetData.trial_start_date);

    } catch (error) {
        console.error('❌ 重置失败:', error.message);
    }
}

// 显示当前订阅状态
function showCurrentStatus() {
    const subscriptionPath = getSubscriptionPath();

    if (!fs.existsSync(subscriptionPath)) {
        console.log('❌ 订阅文件不存在');
        return;
    }

    try {
        // 读取订阅数据（支持加密文件）
        let data;
        if (isFileEncrypted(subscriptionPath)) {
            console.log('检测到加密文件，正在解密...');
            const encryptedData = fs.readFileSync(subscriptionPath);
            const decryptedContent = decryptData(encryptedData);
            data = JSON.parse(decryptedContent);
        } else {
            console.log('检测到未加密文件');
            data = JSON.parse(fs.readFileSync(subscriptionPath, 'utf8'));
        }

        console.log('\n📊 当前订阅状态:');
        console.log('状态:', data.status);
        console.log('套餐:', data.plan);
        console.log('设备ID:', data.device_id);

        if (data.trial_start_date) {
            const trialStart = new Date(data.trial_start_date);
            const trialEnd = new Date(trialStart.getTime() + 3 * 24 * 60 * 60 * 1000);
            const now = new Date();
            const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)));

            console.log('试用开始:', trialStart.toLocaleString());
            console.log('试用结束:', trialEnd.toLocaleString());
            console.log('剩余天数:', daysRemaining);
        }

        if (data.subscription_start_date) {
            console.log('订阅开始:', new Date(data.subscription_start_date).toLocaleString());
        }

        if (data.creem_transaction_id) {
            console.log('Creem 交易ID:', data.creem_transaction_id);
        }

    } catch (error) {
        console.error('❌ 读取状态失败:', error.message);
    }
}

// 加密现有的未加密文件
function encryptExistingFile() {
    const subscriptionPath = getSubscriptionPath();

    if (!fs.existsSync(subscriptionPath)) {
        console.log('❌ 订阅文件不存在');
        return;
    }

    if (isFileEncrypted(subscriptionPath)) {
        console.log('✅ 文件已经是加密状态');
        return;
    }

    try {
        console.log('正在加密现有文件...');
        const content = fs.readFileSync(subscriptionPath, 'utf8');
        const encryptedData = encryptData(content);
        fs.writeFileSync(subscriptionPath, encryptedData);
        console.log('✅ 文件已成功加密');
    } catch (error) {
        console.error('❌ 加密失败:', error.message);
    }
}

// 命令行参数处理
const command = process.argv[2];

switch (command) {
    case 'reset':
        resetSubscription();
        break;
    case 'status':
        showCurrentStatus();
        break;
    case 'encrypt':
        encryptExistingFile();
        break;
    default:
        console.log('使用方法:');
        console.log('  node reset-subscription.js reset   # 重置为试用期');
        console.log('  node reset-subscription.js status  # 显示当前状态');
        console.log('  node reset-subscription.js encrypt # 加密现有文件');
        break;
}