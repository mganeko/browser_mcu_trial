# Browser_MCU

* Browser_MCU is MCU library using a browser for video/audio processing
* Browser_MCU is designed for MediaStreams from WebRTC
* Signaling and handling of PeerConnection are not a part of Browser_MCU
* Browser_MCU はブラウザの映像/音声処理を活用した、MCUライブラリです
* Browser_MCU は WebRTC でやり取りする MediaStream を扱うために作成されています
* シグナリングや PeerConnection の処理は、Browser_MCUには含まれていません

## Confirmed Environment / 動作確認環境

* Chrome  58.0.3029.110 (64-bit) for MacOS X
* Firefox (not yet)


## Samples / サンプル

### Sample for WebRTC SFU Sora

* [WebRTC SFU Sora](https://sora.shiguredo.jp/) sample / サンプル
  * view source on GitHub / ソースを見る
  * try GitHub pages / GitHub pages で試す
* NOTE: You need Sora server to try /  試すにはSoraサーバーが必要です
* Using [sora-js-sdk](https://github.com/shiguredo/sora-js-sdk)  / [sora-js-sdk](https://github.com/shiguredo/sora-js-sdk) をコピーして利用しています

#### How to use Sora sample / サンプル操作手順

* Prepare
  * Setup Sora server before using the sample
  * Connect to same channel_id from multiple browsers with multistream mode
* Open sora_mcu.html with Chrome/Firefox
* Specify Sora signaling URL to [Sora Server:], such as ws://myserver.com:3000/signaling
* Click [Initialize Sora Client] Button
* Specify the channel_id which connected with multistream above to [Channel ID:]
* Click [Connect] Button
* Then, videos/audios are mixed
* Specify another channel to [Mix Channel ID:] and click [Connect Mix] button, to publish mixed video/audio

--

* 事前準備
  * サンプル利用にはSoraサーバーが必要です
  * Soraサーバーの特定のチャネルIDに、multistreamモードで複数のブラウザで接続しておきます
* Chrome/Firefoxブラウザで sora_mcu.html を開きます
* [Sora Server:] にSoraサーバーのシグナリンングURLを入力します(ws://myserver.com:3000/signaling など)
* [Initialize Sora Client]ボタンを押します
* [Channel ID:]に、multisteramで接続しているチャネルIDを指定します
* [Connect]ボタンを押します
* 映像/音声が合成されます
* [Mix Channel ID:]を指定して[Connect Mix]ボタンを押すと、合成した映像/音声を指定したチャネルIDに配信することができます

## Usage / 利用方法

#### Prep

* Load browser_mcu.js in HTML

```
<script src="js/browser_mcu.js"></script>
```

#### Initialization / 初期化

#### Start Mix Video/Audio / 合成の開始
 
#### Stop  Mix Video/Audio / 合成の停止


### Code Samples / コード例

```
```

## License / ライセンス

* Browser_MCU is under the MIT license
* Using [sora.js](https://github.com/shiguredo/sora-js-sdk) under Apache License 2.0 
* Browser_MCUはMITランセンスで提供されます
* [sora.js](https://github.com/shiguredo/sora-js-sdk) は Apache License 2.0 で提供されているものを利用しています



