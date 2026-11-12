require('dotenv').config();
const mqtt = require('mqtt');
const express = require('express');
const path = require('path');

// ---------- MQTT 配置 ----------
const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
const topic = process.env.TOPIC || 'iot/demo/temperature';

// ---------- 数据缓冲区（环形，最多 200 条） ----------
const MAX_RECORDS = 200;
const records = [];

function pushRecord(data) {
  records.push(data);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

// ---------- Express 服务 ----------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// 返回全部缓存数据
app.get('/api/data', (req, res) => {
  res.json(records);
});

// 返回最新一条
app.get('/api/latest', (req, res) => {
  res.json(records[records.length - 1] || null);
});

// 返回服务状态
app.get('/api/status', (req, res) => {
  res.json({
    mqttUrl: url,
    topic,
    connected: client.connected,
    publishedCount,
    bufferedRecords: records.length,
    maxRecords: MAX_RECORDS,
  });
});

const server = app.listen(PORT, () => {
  console.log(`[WEB] Dashboard running at http://localhost:${PORT}`);
});

// ---------- MQTT 发布 ----------
const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
});

let publishedCount = 0;

client.on('connect', () => {
  console.log('[PUB] Connected:', url);

  // 模拟设备上报温度
  setInterval(() => {
    const data = {
      deviceId: 'sensor-001',
      ts: Date.now(),
      temperature: (20 + Math.random() * 5).toFixed(2),
      humidity: (40 + Math.random() * 10).toFixed(2),
    };
    const payload = JSON.stringify(data);
    client.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error('[PUB] Publish error:', err.message);
      } else {
        publishedCount++;
        pushRecord({ ...data, temperature: parseFloat(data.temperature), humidity: parseFloat(data.humidity) });
        console.log('[PUB] Sent:', payload);
      }
    });
  }, 2000);
});

client.on('error', (err) => console.error('[PUB] Error:', err.message));

// 优雅关闭
function shutdown() {
  console.log('\n[SHUTDOWN] Closing...');
  client.end(true);
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
