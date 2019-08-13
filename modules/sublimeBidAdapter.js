import { registerBidder } from '../src/adapters/bidderFactory';
import * as utils from '../src/utils';
import { config } from '../src/config';

const BIDDER_CODE = 'sublime';
const DEFAULT_BID_HOST = 'pbjs.sskzlabs.com';
const DEFAULT_PROTOCOL = 'https';
const SUBLIME_VERSION = '0.4.0';
let SUBLIME_ZONE = null;

const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_TTL = 600;

/**
 * Send a pixel to antenna
 * @param {String} name The pixel name
 * @param {String} [requestId]
 */
function sendAntennaPixel(name, requestId) {
  if (typeof top.sublime !== 'undefined' && typeof top.sublime.analytics !== 'undefined') {
    let param = {
      qs: {
        z: SUBLIME_ZONE
      }
    };
    if (requestId) {
      param.qs.reqid = encodeURIComponent(requestId);
    }
    top.sublime.analytics.fire(SUBLIME_ZONE, name, param);
  } else {
    let et = Math.round(window.performance.now());
    let ts = new Date().getTime();
    let url = 'https://antenna.ayads.co/?t=' + ts + '&z=' + SUBLIME_ZONE + '&e=' + name + '&et=' + et;
    if (requestId) {
      url += '&reqid=' + encodeURIComponent(requestId);
    }
    utils.triggerPixel(url);
  }
}

export const spec = {
  code: BIDDER_CODE,
  aliases: [],

  /**
     * Determines whether or not the given bid request is valid.
     *
     * @param {BidRequest} bid The bid params to validate.
     * @return boolean True if this is a valid bid, and false otherwise.
     */
  isBidRequestValid: (bid) => {
    return !!bid.params.zoneId;
  },

  /**
     * Make a server request from the list of BidRequests.
     *
     * @param {BidRequest[]} validBidRequests An array of bids
     * @param {Object} bidderRequest - Info describing the request to the server.
     * @return ServerRequest Info describing the request to the server.
     */
  buildRequests: (validBidRequests, bidderRequest) => {
    /* DEBUG */
    if (validBidRequests.length > 1) {
      let leftoverZonesIds = validBidRequests.slice(1).map(bid => { return bid.params.zoneId }).join(',');
      utils.logWarn(`Sublime Adapter: ZoneIds ${leftoverZonesIds} are ignored. Only one ZoneId per page can be instanciated.`);
    }

    /* DEBUG */
    SUBLIME_ZONE = params.zoneId;

    let commonPayload = {
      sublimeVersion: SUBLIME_VERSION,
      // Current Prebid params
      prebidVersion: '$prebid.version$',
      currencyCode: config.getConfig('currency.adServerCurrency') || DEFAULT_CURRENCY,
      timeout: config.getConfig('bidderTimeout'),
      pageDomain: utils.getTopWindowUrl(),
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
    }

    return validBidRequests.map(bid => {
      // debug pixel build request
      sendAntennaPixel('dpbduireq', requestId);

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

      let protocol = bid.params.protocol || DEFAULT_PROTOCOL;
      let bidHost = bid.params.bidHost || DEFAULT_BID_HOST;
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
  },

  /**
     * Unpack the response from the server into a list of bids.
     *
     * @param {*} serverResponse A successful response from the server.
     * @param {*} bidRequest An object with bid request informations
     * @return {Bid[]} An array of bids which were nested inside the server.
     */
  interpretResponse: (serverResponse, bidRequest) => {
    // debug pixel interpret response
    sendAntennaPixel('dintres');

    const bidResponses = [];
    const response = serverResponse.body;

    if (response) {
      if (response.timeout || !response.ad || response.ad.match(/<!-- No ad -->/gmi)) {
        // Debug timeout
        if (response.timeout) {
          // Debug timeout from the long polling server
          sendAntennaPixel('dlptimeout', response.requestId);
        } else if (response.ad.match(regexNoAd)) {
          // Debug LP response no ad (a=0 in the notify)
          sendAntennaPixel('dlpnoad', response.requestId);
        } else if (response.ad === '') {
          // Debug no ad in the interpret response, what happenned ?
          sendAntennaPixel('drespnoad', response.requestId);
        }

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

      if (!response.cpm) {
        sendAntennaPixel('dirnocpm', bidResponse.requestId);
      }

      sendAntennaPixel('bid', bidResponse.requestId);
      bidResponses.push(bidResponse);
    } else {
      // debug pixel no request
      sendAntennaPixel('dirnorq');
    }

    return bidResponses;
  },
  getUserSyncs: (syncOptions, serverResponses) => {
    return [];
  },
  onTimeout: (timeoutData) => {
    // debug pixel timeout from pbjs
    utils.logWarn(`Sublime Adapter: Bid timeout.`, timeoutData);
    sendAntennaPixel('dbidtimeout');
  }
};

registerBidder(spec);
