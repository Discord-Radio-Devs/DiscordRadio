const MESSAGES = {
  init: 'init',
  newVideo: 'newVideo',
  pause: 'pause',
  play: 'play',
  seek: 'seek',
  remove: 'remove',
  pageLoaded: 'pageLoaded',
};

let video;
let observer;
let miniplayerCloseButton;
let ignoreNext = false;


// let background.js know the page is loaded
window.addEventListener('load', () => browser.runtime.sendMessage({ type: MESSAGES.pageLoaded }));

// communication with background.js
function handleMessage(req) {
  switch (req.type) {
    case MESSAGES.init:
      return addVideo();
      
    case MESSAGES.remove:
      return removeVideo();
  }

  return true; // indicates an asynchronous response
}
browser.runtime.onMessage.addListener(handleMessage);


async function addVideo() {
  video = document.querySelector('video');
  addObservers();

  video.onpause = () => {
    if (!ignoreNext) browser.runtime.sendMessage({ data: formatData(), type: MESSAGES.pause });
    ignoreNext = false;
  };

  video.onplay = () => {
    browser.runtime.sendMessage({ data: formatData(), type: MESSAGES.play });
  };

  video.onseeked = () => {
    browser.runtime.sendMessage({ data: formatData(), type: MESSAGES.seek });
  };

  return formatData();
}

function addObservers() {
  const titleTag = document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer');
  if (!titleTag) return setTimeout(addObservers, 1000);
  
  observer = new MutationObserver(() => {
    console.log('title changed');
    browser.runtime.sendMessage({ data: formatData(), type: MESSAGES.newVideo });
  });
  
  observer.observe(titleTag, { childList: true });

  const miniPlayerTitle = document.querySelector('.ytd-miniplayer.title yt-formatted-string.miniplayer-title');
  console.dir(miniPlayerTitle);

  let miniObserver = new MutationObserver(() => {
    console.log('miniplayer title changed');
    browser.runtime.sendMessage({ data: formatMiniplayerData(), type: MESSAGES.newVideo });
    addMiniplayerCloseListener();
  });
  
  miniObserver.observe(miniPlayerTitle, { childList: true });
}

function addMiniplayerCloseListener() {
  if (miniplayerCloseButton) return;

  miniplayerCloseButton = document.querySelector('.ytp-miniplayer-close-button');
  if (!miniplayerCloseButton) return setTimeout(addMiniplayerCloseListener, 1000);

  miniplayerCloseButton.addEventListener('click', () => {
    console.log('removing');
    browser.runtime.sendMessage({ type: MESSAGES.remove });
    ignoreNext = true;
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

  if (document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer')) {
    playerInfo.title = document.querySelector('.title yt-formatted-string.ytd-video-primary-info-renderer').innerText;
    playerInfo.channelName = document.querySelector('.ytd-channel-name yt-formatted-string.ytd-channel-name').innerText;
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

  return {
    ...playerInfo,
    URL: `${location.href}`.replaceAll(/&t=\d+s(?=&|$)/g, ''),
    currTime: Math.floor(video.currentTime),
    paused: video.paused,
  }
}

function formatMiniplayerData() {
  const playerInfo = {};
  playerInfo.title = document.querySelector('.ytd-miniplayer.title yt-formatted-string.miniplayer-title').innerText;
  playerInfo.channelName = document.querySelector('.ytd-miniplayer.channel > yt-formatted-string#owner-name').innerText;

  return {
    ...playerInfo,
    URL: `${location.href}`.replaceAll(/&t=\d+s(?=&|$)/g, ''),
    currTime: Math.floor(video.currentTime),
    paused: video.paused,
  }
}
