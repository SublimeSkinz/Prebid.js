import { registerBidder } from '../src/adapters/bidderFactory';
import { config } from '../src/config';
import * as utils from '../src/utils';
import * as url from '../src/url';

const BIDDER_CODE = 'sublime';
const DEFAULT_BID_HOST = 'pbjs.sskzlabs.com';
const DEFAULT_CALLBACK_NAME = 'sublime_prebid_callback';
const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_PROTOCOL = 'https';
const DEFAULT_SAC_HOST = 'sac.ayads.co'
const DEFAULT_TTL = 600;
const SUBLIME_ANTENNA = 'antenna.ayads.co';
const SUBLIME_VERSION = '0.5.0';

/**
 * Debug log message
 * @param {String} msg
 * @param {Object} obj
 */
function log(msg, obj) {
  utils.logInfo('SublimeBidAdapter - ' + msg, obj)
}

// Default state
const state = {
  zoneId: '',
  gdpr: {
    consent: 0,
    applies: 0,
    source: false,
  },
  transactionId: ''
};

/**
 * Set a new state
 * @param {Object} value
 */
function setState(value) {
  Object.assign(state, value)
  log('State has been updated :', state)
}

/**
 * Send pixel to our debug endpoint
 * @param {string} eventName - Event name that will be send in the e= query string
 */
function sendEvent(eventName) {
  let eventObject = {
    tse: Date.now(),
    z: state.zoneId,
    gm: state.gdpr.consent,
    ga: state.gdpr.applies,
    gs: state.gdpr.source,
    e: eventName,
    src: 'pa',
    trId: state.transactionId,
    ver: SUBLIME_VERSION,
  };

  let queryString = url.formatQS(eventObject);

  log('Sending pixel for event: ' + eventName, eventObject);
  utils.triggerPixel('https://' + SUBLIME_ANTENNA + '/?' + queryString);
}

/**
 * Determines whether or not the given bid request is valid.
 *
 * @param {BidRequest} bid The bid params to validate.
 * @return {Boolean} True if this is a valid bid, and false otherwise.
 */
function isBidRequestValid(bid) {
  return !!bid.params.zoneId;
}

/**
 * Make a server request from the list of BidRequests.
 *
 * @param {BidRequest[]} validBidRequests An array of bids
 * @param {Object} bidderRequest - Info describing the request to the server.
 * @return ServerRequest Info describing the request to the server.
 */
function buildRequests(validBidRequests, bidderRequest) {
  window.sublime = window.sublime ? window.sublime : {};

  let commonPayload = {
    sublimeVersion: SUBLIME_VERSION,
    // Current Prebid params
    prebidVersion: '$prebid.version$',
    currencyCode: config.getConfig('currency.adServerCurrency') || DEFAULT_CURRENCY,
    timeout: typeof bidderRequest !== 'undefined' ? bidderRequest.timeout : config.getConfig('bidderTimeout'),
  };

  // RefererInfo
  if (bidderRequest && bidderRequest.refererInfo) {
    commonPayload.referer = bidderRequest.refererInfo.referer;
    commonPayload.numIframes = bidderRequest.refererInfo.numIframes;
  }
  // GDPR handling
  if (bidderRequest && bidderRequest.gdprConsent) {
    commonPayload.gdprConsent = bidderRequest.gdprConsent.consentString;
    commonPayload.gdpr = bidderRequest.gdprConsent.gdprApplies; // we're handling the undefined case server side

    setState({
      gdpr: {
        consent: bidderRequest.gdprConsent.consentString ? 1 : 0,
        applies: bidderRequest.gdprConsent.gdprApplies ? 1 : 0,
        source: bidderRequest.gdprConsent.consentString ? 'cmp' : '',
      }
    });

    // Injecting gdpr consent into sublime tag
    window.sublime.gdpr = (typeof window.sublime.gdpr !== 'undefined') ? window.sublime.gdpr : {};
    window.sublime.gdpr.injected = {
      consentString: bidderRequest.gdprConsent.consentString,
      gdprApplies: bidderRequest.gdprConsent.gdprApplies
    };
  }

  return validBidRequests.map(bid => {
    let bidHost = bid.params.bidHost || DEFAULT_BID_HOST;
    let callbackName = (bid.params.callbackName || DEFAULT_CALLBACK_NAME) + '_' + bid.params.zoneId;
    let protocol = bid.params.protocol || DEFAULT_PROTOCOL;
    let sacHost = bid.params.sacHost || DEFAULT_SAC_HOST;

    setState({ transactionId: bid.transactionId, zoneId: bid.params.zoneId });

    // Adding Sublime tag
    let script = document.createElement('script');
    script.type = 'application/javascript';
    script.src = 'https://' + sacHost + '/sublime/' + bid.params.zoneId + '/prebid?callback=' + callbackName;
    document.body.appendChild(script);

    // Register a callback to send notify
    window[callbackName] = (response) => {
      var hasAd = response.ad ? '1' : '0';
      var xhr = new XMLHttpRequest();
      var params = {
        a: hasAd,
        ad: response.ad || '',
        cpm: response.cpm || 0,
        currency: response.currency || 'USD',
        notify: 1,
        requestId: bid.bidId ? encodeURIComponent(bid.bidId) : null,
        transactionId: bid.transactionId,
        zoneId: bid.params.zoneId
      };
      var queryString = Object.keys(params).map(function (key) {
        return key + '=' + encodeURIComponent(params[key])
      }).join('&');
      var url = protocol + '://' + bidHost + '/notify?' + queryString;

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send();
      return xhr;
    };

    let bidPayload = {
      adUnitCode: bid.adUnitCode,
      auctionId: bid.auctionId,
      bidder: bid.bidder,
      bidderRequestId: bid.bidderRequestId,
      bidRequestsCount: bid.bidRequestsCount,
      requestId: bid.bidId,
      sizes: bid.sizes.map(size => ({
        w: size[0],
        h: size[1],
      })),
      transactionId: bid.transactionId,
      zoneId: bid.params.zoneId,
    };

    let payload = Object.assign({}, commonPayload, bidPayload);

    return {
      method: 'POST',
      url: protocol + '://' + bidHost + '/bid',
      data: payload,
      options: {
        contentType: 'application/json',
        withCredentials: true
      },
    };
  });
}

/**
 * Unpack the response from the server into a list of bids.
 *
 * @param {*} serverResponse A successful response from the server.
 * @param {*} bidRequest An object with bid request informations
 * @return {Bid[]} An array of bids which were nested inside the server.
 */
function interpretResponse(serverResponse, bidRequest) {
  const bidResponses = [];
  const response = serverResponse.body;

  if (response) {
    if (response.timeout || !response.ad || response.ad.match(/<!-- No ad -->/gmi)) {
      return bidResponses;
    }

    // Setting our returned sizes object to default values
    let returnedSizes = {
      width: 1800,
      height: 1000
    };

    // Verifying Banner sizes
    if (bidRequest && bidRequest.data && bidRequest.data.w === 1 && bidRequest.data.h === 1) {
      // If banner sizes are 1x1 we set our default size object to 1x1
      returnedSizes = {
        width: 1,
        height: 1
      };
    }

    const bidResponse = {
      requestId: response.requestId || '',
      cpm: response.cpm || 0,
      width: response.width || returnedSizes.width,
      height: response.height || returnedSizes.height,
      creativeId: response.creativeId || 1,
      dealId: response.dealId || 1,
      currency: response.currency || DEFAULT_CURRENCY,
      netRevenue: response.netRevenue || true,
      ttl: response.ttl || DEFAULT_TTL,
      ad: response.ad,
    };

    sendEvent('bid');
    bidResponses.push(bidResponse);
  }

  return bidResponses;
}

/**
 * Send debug when we timeout
 * @param {Object} timeoutData
 */
function onTimeout(timeoutData) {
  log('Timeout from adapter', timeoutData);
  sendEvent('dbidtimeout');
}

export const spec = {
  code: BIDDER_CODE,
  aliases: [],
  isBidRequestValid: isBidRequestValid,
  buildRequests: buildRequests,
  interpretResponse: interpretResponse,
  onTimeout: onTimeout,
};

registerBidder(spec);
