<p align="center">
<a href="https://www.npmjs.com/package/upimg">
<img src="https://user-images.githubusercontent.com/2666735/53743687-5d416100-3ed6-11e9-9fe8-5a8581c48157.png">
</a>
</p>

<p align="center">An encrypted proxy service program through websocket.</p>

<p align=center>
<a href="https://hub.docker.com/r/metowolf/wsdog">Docker Hub</a> ·
<a href="https://github.com/metowolf/wsdog/">Project Source</a> ·
<a href="https://t.me/wsdog">Telegram Channel</a>
</p>

***

## latest version

|version|
|---|
|metowolf/wsdog:latest|


## environment variables

### server

|name|value|
|---|---|
|**KEY**|`wsdog`|
|**METHOD**|`aes-256-gcm`|
|SERVER_HOST|0.0.0.0|
|SERVER_PORT|80|
|SERVER_PATH|/|

### client

|name|value|
|---|---|
|**URL**|`ws://127.0.0.1:80/`|
|**KEY**|`wsdog`|
|**METHOD**|`aes-256-gcm`|
|TIMEOUT|600|
|LOCAL_HOST|127.0.0.1|
|LOCAL_PORT|1080|

### support methods
|method|
|---|
|none|
|aes-128-gcm|
|aes-192-gcm|
|aes-256-gcm|

***

### Pull the image

```bash
$ docker pull metowolf/wsdog
```

### Start a server container

|key|value|
|---|---|
|HOSTNAME|`example.com`|

```bash
$ docker run -p 80:80 -d \
  -e KEY="example" \
  -e METHOD="aes-128-gcm" \
  --restart always --name=wsdog_server metowolf/wsdog
```

### Start a client container

```bash
$ docker run -p 127.0.0.1:1080:1080 -d \
  -e KEY="example" \
  -e METHOD="aes-128-gcm" \
  -e URL="ws://example.com/" \
  -e LOCAL_HOST="0.0.0.0" \
  --restart always --name=wsdog_client \
  metowolf/wsdog yarn client
```

### Test Using curl

```bash
$ curl -Lx socks5h://127.0.0.1:1080 www.google.com
```
