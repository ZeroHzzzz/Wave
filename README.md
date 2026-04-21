# Wave

一个基于 `React + TypeScript + Vite` 的串口示波器与 PID 调参上位机。

当前版本面向 `wave -> velix` 联调，职责分成两部分：

- 波形接收：按行接收文本数据并绘制多通道曲线
- 参数发送：按 `VX/1` 二进制帧协议发送 PID 参数到下位机

## 核心能力

- 串口实时接收并绘制多通道波形
- 支持动态识别通道数量
- 支持 `String / Hex Raw` 串口控制台
- 支持 PID 参数卡片编辑、单卡发送、批量发送
- 支持 PID 参数导入/导出为 `JSON`
- 支持示波器区域高度拖动

## 环境要求

- Node.js 18+
- Chrome / Edge 等支持 `Web Serial API` 的浏览器

说明：

- 项目依赖浏览器串口能力，不支持 `Web Serial API` 的浏览器无法使用串口功能
- 首次使用串口时，浏览器会弹出设备授权窗口

## 安装与启动

```bash
npm install
npm run dev
```

默认开发环境启动后，按 Vite 控制台输出的地址访问即可。

构建生产版本：

```bash
npm run build
```

本地预览构建结果：

```bash
npm run preview
```

## 页面功能

页面主要分为 3 个区域。

### 1. Oscilloscope Workspace

上方区域用于串口连接、波形显示和通道控制。

支持：

- `Select Device`：选择串口设备
- `Connect / Disconnect`：连接或断开当前设备
- `Freeze / Resume`：冻结或恢复波形刷新
- `Auto Scale`：自动调整 Y 轴范围
- `Clear`：清空当前波形数据和控制台数据
- `Baud`：串口波特率
- `Delimiter`：接收数据字段分隔符
- `Cache`：历史缓存点数上限

### 2. PID Parameter Cards

左下区域用于管理 PID 参数卡片。

支持：

- 新增 PID 卡片
- 编辑卡片名称和目标 `Target ID`
- 编辑 PID 浮点参数
- 编辑功能开关位
- 单卡发送
- 全部发送
- 导入 / 导出 `JSON`

### 3. Data Stream

右下区域是串口控制台。

支持：

- 查看接收数据 `RX`
- 查看发送数据 `TX`
- `String` 模式查看文本内容
- `Hex Raw` 模式查看原始十六进制字节
- `RX + TX / Only RX` 过滤
- 清空控制台

## 串口使用流程

推荐按下面流程使用：

1. 点击 `Select Device` 选择目标串口设备
2. 设置 `Baud`
3. 根据下位机波形输出格式选择 `Delimiter`
4. 点击 `Connect`
5. 查看波形与控制台
6. 如需调参，在 PID 卡片区域填写参数并发送

说明：

- 项目会记住浏览器已授权的设备，刷新页面后会尝试恢复已授权串口选择状态
- 连接按钮和设备选择按钮分离，便于切换设备
- 如果连接失败，不会继续复用失败设备

## 波形接收协议

### 基本规则

波形接收协议是“按行接收、按分隔符拆字段”的文本协议。

每一行代表一个采样点，例如：

```text
v1,v2,v3,...
```

或：

```text
v1 v2 v3 ...
```

一帧数据必须以换行结束：

- `\n`
- 或 `\r\n`

### 分隔符

当前支持以下分隔方式：

- `,`
- 空格
- `\t`
- `;`

在界面中通过 `Delimiter` 下拉框切换。

### 数值解析规则

每个字段按 `parseFloat` 解析为浮点数。

示例：

```text
1.0,2.5,-3.2
```

```text
0.12 0.34 0.56
```

如果某个字段无法解析成合法数字，对应通道值会记为 `null`。

### 通道数规则

通道数由当前收到的一行数据字段数量自动推断。

例如：

```text
1.0,2.0
```

表示当前帧有 2 个通道；

```text
1.0,2.0,3.0,4.0
```

表示当前帧有 4 个通道。

当接收到的字段数变化时，界面会自动增减通道控制卡片。

### 时间轴规则

当前横轴时间不是下位机发来的时间戳，而是上位机根据接收节奏生成的相对时间。

也就是说：

- X 轴用于反映数据到达节奏
- 不要求下位机额外发送时间字段

## PID 发送协议

### 当前协议

PID 发送不再使用文本命令，而是使用 `VX/1` 二进制帧协议。

一帧结构如下：

```text
SOF0 SOF1 VER TYPE LEN SEQ PAYLOAD CRC16
```

固定字段：

- `SOF0 = 0x56`
- `SOF1 = 0x58`
- `VER = 0x01`
- `TYPE = 0x01`，表示 `PID_SET`
- `LEN = 38`，表示当前 PID 负载长度

### Payload 布局

`PAYLOAD` 固定为 38 字节，布局如下：

1. `targetId`，1 字节
2. `flags`，1 字节
3. `kp`，`float32`，小端
4. `ki`，`float32`，小端
5. `kd`，`float32`，小端
6. `outMax`，`float32`，小端
7. `intMax`，`float32`，小端
8. `sepErr`，`float32`，小端
9. `errMax`，`float32`，小端
10. `pol`，`float32`，小端
11. `tMs`，`float32`，小端

### Target ID 约定

当前与下位机约定：

- `1`：`turn_pos`
- `2`：`turn_gyro`
- `3`：`vel_left`
- `4`：`vel_right`

界面里 `Target ID` 需要填写数值字符串，例如 `1`、`2`、`3`、`4`。

### Flags 编码

`flags` 为位标志：

- bit0：`enable`
- bit1：`outLim`
- bit2：`intLim`
- bit3：`intSep`
- bit4：`errLim`

也就是：

- `enable = true` 时置位 bit0
- `outLim = true` 时置位 bit1
- `intLim = true` 时置位 bit2
- `intSep = true` 时置位 bit3
- `errLim = true` 时置位 bit4

### CRC

帧尾使用 `CRC16-CCITT`。

计算范围为：

```text
[VER, TYPE, LEN, SEQ, PAYLOAD...]
```

发送时按小端写入 CRC：

- 低字节在前
- 高字节在后

### 发送校验

发送前会检查：

- `targetId` 必须是 `1-255` 的整数
- 所有浮点参数必须是可解析的有限数值

如果参数不完整，卡片不会发送。

### 发送示例

控制台 `String` 模式下，PID 发送日志显示为：

```text
PID_SET target=1 seq=27
```

控制台 `Hex Raw` 模式下，可以看到对应二进制帧的原始字节。

## 下位机回包

当前 `velix` 下位机在 PID 设置成功时会返回文本：

```text
#TUNER,OK,<seq>,<target>\r\n
```

出错时会返回：

```text
#TUNER,ERR,<seq>,<target>,<reason>\r\n
```

例如：

```text
#TUNER,OK,27,1
```

这类回包会在 `Data Stream` 的 `RX` 区域中显示。

## PID JSON 导入导出

### 导出

PID 参数可导出为 `JSON` 文件。

导出时会保留适合阅读的普通小数格式，例如：

- `8e-5` 会导出为 `0.00008`

### 导入

导入时支持两种格式：

- 直接传卡片数组
- 带 `cards` 字段的对象

当前导出结构示例：

```json
{
  "version": 1,
  "exportedAt": "2026-04-20T00:19:41.917Z",
  "cards": [
    {
      "uid": "pid-card-xxx",
      "name": "PID Card 1",
      "targetId": "1",
      "kp": "0.013",
      "ki": "0",
      "kd": "0.0025",
      "outMax": "100",
      "intMax": "100",
      "sepErr": "0",
      "errMax": "0",
      "pol": "1",
      "tMs": "5",
      "enable": true,
      "outLim": true,
      "intLim": true,
      "intSep": false,
      "errLim": false
    }
  ]
}
```

## 控制台说明

`Data Stream` 显示的是串口收发日志：

- `RX`：从串口收到的数据
- `TX`：上位机发出去的数据
- `ERROR`：发送失败等错误信息

两种显示模式：

- `String`：直接显示文本内容
- `Hex Raw`：显示字节十六进制内容

建议联调时：

- 看下位机回包时使用 `String`
- 看 PID 原始二进制帧时使用 `Hex Raw`

## 常见注意事项

### 1. 连接不上串口

请检查：

- 浏览器是否支持 `Web Serial API`
- 串口是否被其他软件占用
- 波特率是否与下位机一致
- 是否已经先点击 `Select Device`

### 2. 波形不显示

请检查：

- 下位机每帧是否以换行结束
- `Delimiter` 是否选择正确
- 数据字段是否是合法数字
- 通道是否被关闭显示

### 3. PID 发送后设备无响应

请检查：

- 下位机是否已经切到当前 `VX/1` 二进制协议
- `Target ID` 是否与设备端约定一致
- 波特率是否正确
- 是否在 `Hex Raw` 模式下确认过 TX 字节确实发出

### 4. 下位机返回 OK 但参数没生效

请检查：

- `targetId` 是否指向了正确 PID 通道
- `flags` 是否符合预期
- `tMs`、`pol`、限幅参数是否填对
- 下位机侧是否还有额外业务逻辑覆盖参数

## 技术栈

- React 19
- TypeScript
- Vite
- ECharts
- Web Serial API

## 目录结构

```text
src/
  components/   UI 组件
  hooks/        状态与行为逻辑
  utils/        协议与持久化工具
  constants/    默认配置
  styles/       分模块样式
```

## 后续可扩展方向

- 增加更多消息类型，例如状态设置、目标值设置
- 增加串口发送历史模板
- 增加多设备协议配置
- 增加波形截图或数据导出
