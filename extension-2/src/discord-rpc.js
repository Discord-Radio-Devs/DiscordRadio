class DiscordRPC {
  static AUTH_URL = 'https://discordapp.com/api/oauth2/token';
  static URL = `ws://localhost:6472`;
  static VERSION = 1;
  static ENCODING = 'json';

  client_id;
  conn;
  user;

  constructor(client_id) {
    this.client_id = client_id;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `${DiscordRPC.URL}/?v=${DiscordRPC.VERSION}&client_id=${this.client_id}&encoding=${DiscordRPC.ENCODING}`;
      this.conn = new WebSocket(url);
      this.conn.addEventListener('error', reject);
      this.conn.addEventListener('open', async () => {
        const { data: { user } } = await this._getDiscordResponse();
        this.user = user;
        this.user.tag = `${user.username}#${user.discriminator}`;
        resolve(this);
      });
    });
  }

  async login({ client_secret, redirect_uri, refresh_token }) {
    const tokens = await this.authorize({ client_secret, redirect_uri, refresh_token });
    await this.authenticate(tokens.access_token);
    return tokens;
  }

  on(event, callback) {
    if (event === 'message') {
      this.conn.addEventListener('message', msg => callback(JSON.parse(msg.data)));
    }
    else {
      this.conn.addEventListener(event, callback);
    }
  }

  close() {
    this.conn.close();
  }



  async authorize({ client_secret, redirect_uri, refresh_token }) {
    if (refresh_token) {
      return fetch(DiscordRPC.AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 
          `grant_type=refresh_token&refresh_token=${refresh_token}` +
          `&client_id=${this.client_id}&client_secret=${client_secret}`
      }).then(res => res.json());
    }

    this._send('AUTHORIZE',{ client_id: this.client_id, scopes: ['identify'] });
    const { data: { code: authCode } } = await this._getDiscordResponse();

    return fetch(DiscordRPC.AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 
        `grant_type=authorization_code&code=${authCode}&redirect_uri=${redirect_uri}` +
        `&client_id=${this.client_id}&client_secret=${client_secret}`
    }).then(res => res.json());
  }

  authenticate(access_token) {
    this._send('AUTHENTICATE', { access_token });
    return this._getDiscordResponse().then(msg => msg.data);
  }

  getGuild(args) {
    return this._send('GET_GUILD', args);
  }

  getGuilds() {
    return this._send('GET_GUILDS', {});
  }

  getChannel(args) {
    return this._send('GET_CHANNEL', args);
  }

  getChannels(args) {
    return this._send('GET_CHANNELS', args);
  }

  setUserVoiceSettings(args) {
    return this._send('SET_USER_VOICE_SETTINGS', args);
  }

  selectVoiceChannel(args) {
    return this._send('SELECT_VOICE_CHANNEL', args);
  }

  getSelectedVoiceChannel() {
    return this._send('GET_SELECTED_VOICE_CHANNEL', {});
  }

  selectTextChannel(args) {
    return this._send('SELECT_TEXT_CHANNEL', args);
  }

  getVoiceSettings() {
    return this._send('GET_VOICE_SETTINGS', {});
  }

  setVoiceSettings(args) {
    return this._send('SET_VOICE_SETTINGS', args);
  }

  subscribe(evt, args, callback = undefined) {
    const nonce = new UUID(4).format();
    this.conn.send(JSON.stringify({ nonce, cmd: 'SUBSCRIBE', evt, args }));

    if (callback) {
      this.on('message', msg => {
        if (msg.evt === evt) callback(msg.data);
      });
    }

    return nonce;
  }

  unsubscribe(evt, args) {
    const nonce = new UUID(4).format();
    this.conn.send(JSON.stringify({ nonce, cmd: 'UNSUBSCRIBE', evt, args }));
    return nonce;
  }

  setCertifiedDevices(args) {
    return this._send('SET_CERTIFIED_DEVICES', args);
  }

  setActivity(args) {
    return this._send('SET_ACTIVITY', args);
  }

  sendActivityJoinInvite(args) {
    return this._send('SEND_ACTIVITY_JOIN_INVITE', args);
  }

  closeActivityRequest(args) {
    return this._send('CLOSE_ACTIVITY_REQUEST', args);
  }



  _getDiscordResponse() {
    return new Promise((resolve, reject) => {
      this.conn.addEventListener('message', msg => resolve(JSON.parse(msg.data)), { once: true });
    });
  }

  _send(cmd, args) {
    const nonce = new UUID(4).format();
    this.conn.send(JSON.stringify({ nonce, cmd, args }));
    return nonce;
  }
}
