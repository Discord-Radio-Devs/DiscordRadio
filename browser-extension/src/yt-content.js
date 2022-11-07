const MESSAGES = {
  init: 'init',
  newVideo: 'newVideo',
  pause: 'pause',
  play: 'play',
  seek: 'seek',
  remove: 'remove',
  pageLoaded: 'pageLoaded',
  update: 'update',
  error: 'error',
};

let video;
let observer, miniObserver;
let miniplayerCloseButton;
let miniPlaying = false;
let ignoreNext = false;
let nextMiniplayerUrl;

// let background.js know the page is loaded
window.addEventListener('load', () => browser.runtime.sendMessage({ type: MESSAGES.pageLoaded }));

// communication with background.js
function handleMessage(req) {
  switch (req.type) {
    case MESSAGES.init:
      return addVideo();
      
    case MESSAGES.remove:
      return removeVideo();

    case MESSAGES.update:
      return update();

    case MESSAGES.error: 
      alert(req.data);
      return Promise.resolve();
  }

  return true; // indicates an asynchronous response
}
browser.runtime.onMessage.addListener(handleMessage);

const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
});

async function addVideo() {
  video = document.querySelector('video');
  if(!video){
    await delay(1000);
    return addVideo()
  }
  addObservers();

  video.onpause = () => {
    const data = (miniPlaying) ? formatMiniplayerData() : formatData();
    if (!ignoreNext) browser.runtime.sendMessage({ data, type: MESSAGES.pause });
    ignoreNext = false;
  };

  video.onplay = () => {
    const data = (miniPlaying) ? formatMiniplayerData() : formatData();
    if (!ignoreNext) browser.runtime.sendMessage({ data, type: MESSAGES.play });
  };

  video.onseeked = () => {
    const data = (miniPlaying) ? formatMiniplayerData() : formatData();
    browser.runtime.sendMessage({ data, type: MESSAGES.seek });
  };

  return formatData();
}

async function update() {
  const data = (miniPlaying) ? formatMiniplayerData() : formatData();
  return browser.runtime.sendMessage({ data, type: MESSAGES.newVideo });
}

function addObservers() {
  const titleTag = document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer');
  if (!titleTag) return setTimeout(addObservers, 1000);
  
  observer = new MutationObserver(() => {
    browser.runtime.sendMessage({ data: formatData(), type: MESSAGES.newVideo });
  });
  
  observer.observe(titleTag, { childList: true });

  const miniPlayerTitle = document.querySelector('.ytd-miniplayer.title yt-formatted-string.miniplayer-title');

  miniObserver = new MutationObserver(() => {
    miniPlaying = true;
    ignoreNext = true;
    browser.runtime.sendMessage({ data: formatMiniplayerData(), type: MESSAGES.newVideo });
    addMiniplayerCloseListener();
  });
  
  miniObserver.observe(miniPlayerTitle, { childList: true });
}

function addMiniplayerCloseListener() {
  if (miniplayerCloseButton) {
    nextMiniplayerUrl = document.querySelector('.ytp-miniplayer-button-container .ytp-next-button').href;
    return;
  }

  miniplayerCloseButton = document.querySelector('.ytp-miniplayer-close-button');
  if (!miniplayerCloseButton) return setTimeout(addMiniplayerCloseListener, 1000);

  nextMiniplayerUrl = document.querySelector('.ytp-miniplayer-button-container .ytp-next-button').href;

  miniplayerCloseButton.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: MESSAGES.remove });
    miniPlaying = false;
    nextMiniplayerUrl = null;
    ignoreNext = true;
  });

  document.querySelector('.ytp-miniplayer-expand-watch-page-button').addEventListener('click', e => {
    miniPlaying = false;
    nextMiniplayerUrl = null;
  });
}

async function removeVideo() {
  if (video) {
    video.onpause = null;
    video.onplay = null;
    video.onseeked = null;
    video = null;
  }
}

function formatData() {
  const playerInfo = {};
  nextMiniplayerUrl = null;

  if (document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer')) {
    playerInfo.title = document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer').innerText;
    playerInfo.channelName = document.querySelector('.style-scope ytd-video-owner-renderer').innerText.split('\n')[0];
  }
  else if (document.querySelector('#scriptTag')) {
    const info = JSON.parse(document.querySelector('#scriptTag')?.textContent);
    playerInfo.title = info.name;
    playerInfo.channelName = info.author;
  }
  else if (document.querySelector('meta[itemprop="name"]')) {
    playerInfo.title = document.querySelector('meta[itemprop="name"]').content;
    playerInfo.channelName = document.querySelector('span[itemprop="author"] link[itemprop="name"]').attributes.content.value;
  }

  console.dir({
    ...playerInfo,
    URL: `${location.href}`.replaceAll(/&t=\d+s(?=&|$)/g, ''),
    currTime: Math.floor(video?.currentTime ?? 0),
    paused: video?.paused ?? false,
  })

  return {
    ...playerInfo,
    URL: `${location.href}`.replaceAll(/&t=\d+s(?=&|$)/g, ''),
    currTime: Math.floor(video?.currentTime ?? 0),
    paused: video?.paused ?? false,
  }
}

function formatMiniplayerData() {
  const playerInfo = {};
  playerInfo.title = document.querySelector('.ytd-miniplayer.title yt-formatted-string.miniplayer-title').innerText;
  playerInfo.channelName = document.querySelector('.ytd-miniplayer.channel > yt-formatted-string#owner-name').innerText;
  
  if (document.querySelector('ytd-thumbnail[now-playing] #thumbnail.yt-simple-endpoint')) {
    console.log('A');
    playerInfo.URL = document.querySelector('ytd-thumbnail[now-playing] #thumbnail.yt-simple-endpoint').href;
  }
  else if (document.querySelector('#page-manager ytd-watch-flexy.ytd-page-manager')?.videoId) {
    console.log('B');
    playerInfo.URL = document.querySelector('#page-manager ytd-watch-flexy.ytd-page-manager').videoId;
  }
  else if (nextMiniplayerUrl) {
    console.log('C');
    playerInfo.URL = nextMiniplayerUrl;
  }
  else {
    console.log('D');
    playerInfo.URL = document.querySelector('link[rel="canonical"]').href;
  }

  return {
    ...playerInfo,
    currTime: Math.floor(video.currentTime),
    paused: video.paused,
  }
}
