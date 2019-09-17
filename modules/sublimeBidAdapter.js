import { registerBidder } from '../src/adapters/bidderFactory';
import { config } from '../src/config';

const BIDDER_CODE = 'sublime';
const DEFAULT_BID_HOST = 'pbjs.sskzlabs.com';
const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_PROTOCOL = 'https';
const DEFAULT_TTL = 600;
const SUBLIME_VERSION = '0.4.0';

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
    window.sublime = window.sublime ? window.sublime : {};

    let commonPayload = {
      sublimeVersion: SUBLIME_VERSION,
      // Current Prebid params
      prebidVersion: '$prebid.version$',
      currencyCode: config.getConfig('currency.adServerCurrency') || DEFAULT_CURRENCY,
      timeout: config.getConfig('bidderTimeout'),
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

      // Injecting gdpr consent into sublime tag
      window.sublime.gdpr = (typeof window.sublime.gdpr !== 'undefined') ? window.sublime.gdpr : {};
      window.sublime.gdpr.injected = {
        consentString: gdpr.consentString,
        gdprApplies: gdpr.gdprApplies
      };
    }

    let sacHost = params.sacHost || DEFAULT_SAC_HOST;
    let bidHost = params.bidHost || DEFAULT_BID_HOST;
    let protocol = params.protocol || DEFAULT_PROTOCOL;
    let callbackName = (params.callbackName || DEFAULT_CALLBACK_NAME) + '_' + params.zoneId;

    // Register a callback to send notify
    window[callbackName] = (response) => {
      var hasAd = response.ad ? '1' : '0';
      var xhr = new XMLHttpRequest();
      var url = protocol + '://' + bidHost + '/notify';
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.send(JSON.stringify(
        {
          a: hasAd,
          ad: response.ad || '',
          cpm: response.cpm || 0,
          currency: response.currency || 'USD',
          notify: 1,
          requestId: bid.bidId ? encodeURIComponent(bid.bidId) : null,
          transactionId: bid.transactionId,
          zoneId: params.zoneId || __SAC.ZONE_ID
        }
      ));
      return xhr;
    };

    // Adding Sublime tag
    let script = document.createElement('script');
    script.type = 'application/javascript';
    script.src = 'https://' + sacHost + '/sublime/' + SUBLIME_ZONE + '/prebid?callback=' + callbackName;
    document.body.appendChild(script);

    return validBidRequests.map(bid => {
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

      // TODO: Should we sent transactionId our requestId ?
      sendAntennaPixel('bid', bidResponse.transactionId);
      bidResponses.push(bidResponse);
    }

    return bidResponses;
  },
  // onTimeout: (bid) => {
  //   // TODO: Use the pixel name we defined
  //   sendAntennaPixel('timeout', {...bid});
  // },
};

registerBidder(spec);
