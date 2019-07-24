import { registerBidder } from '../src/adapters/bidderFactory';
import { config } from '../src/config';
import * as utils from '../src/utils';

const BIDDER_CODE = 'sublime';
const DEFAULT_BID_HOST = 'pbjs.sskzlabs.com';
const DEFAULT_SAC_HOST = 'sac.ayads.co';
const DEFAULT_PROTOCOL = 'https';
const SUBLIME_VERSION = '0.3.6';
let SUBLIME_ZONE = null;

export const spec = {
  code: BIDDER_CODE,
  aliases: ['sskz', 'sublime-skinz'],

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

    if (bidderRequest && bidderRequest.gdprConsent) {
      const gdpr = {
        consentString: bidderRequest.gdprConsent.consentString,
        gdprApplies: (typeof bidderRequest.gdprConsent.gdprApplies === 'boolean') ? bidderRequest.gdprConsent.gdprApplies : true
      };

      window.sublime.gdpr = (typeof window.sublime.gdpr !== 'undefined') ? window.sublime.gdpr : {};
      window.sublime.gdpr.injected = {
        consentString: gdpr.consentString,
        gdprApplies: gdpr.gdprApplies
      };
    }

    // Grab only the first `validBidRequest`
    let bid = validBidRequests[0];

    if (validBidRequests.length > 1) {
      let leftoverZonesIds = validBidRequests.slice(1).map(bid => { return bid.params.zoneId }).join(',');
      utils.logWarn(`Sublime Adapter: ZoneIds ${leftoverZonesIds} are ignored. Only one ZoneId per page can be instanciated.`);
    }

    let params = bid.params;
    let requestId = bid.bidId || '';
    let sacHost = params.sacHost || DEFAULT_SAC_HOST;
    let bidHost = params.bidHost || DEFAULT_BID_HOST;
    let protocol = params.protocol || DEFAULT_PROTOCOL;
    SUBLIME_ZONE = params.zoneId;

    window.sublime.pbjs = (typeof window.sublime.pbjs !== 'undefined') ? window.sublime.pbjs : {};
    window.sublime.pbjs.injected = {
      bt: config.getConfig('bidderTimeout'),
      ts: Date.now(),
      version: SUBLIME_VERSION,
      requestId
    };

    let script = document.createElement('script');
    script.type = 'application/javascript';
    script.src = 'https://' + sacHost + '/sublime/' + SUBLIME_ZONE + '/prebid?callback=false';
    document.body.appendChild(script);

    // Initial size object
    let sizes = {
      w: null,
      h: null
    };

    if (bid.mediaTypes && bid.mediaTypes.banner && bid.mediaTypes.banner.sizes && bid.mediaTypes.banner.sizes[0]) {
      // Setting size for banner if they exist
      sizes.w = bid.mediaTypes.banner.sizes[0][0] || false;
      sizes.h = bid.mediaTypes.banner.sizes[0][1] || false;
    }

    return {
      method: 'GET',
      url: protocol + '://' + bidHost + '/bid',
      data: {
        prebid: 1,
        request_id: requestId,
        z: SUBLIME_ZONE,
        w: sizes.w || 1800,
        h: sizes.h || 1000
      }
    };
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
      // Setting our returned sizes object to default values
      let returnedSizes = {
        width: 1800,
        height: 1000
      };

      // Verifying Banner sizes
      if (bidRequest && bidRequest.data.w === 1 && bidRequest.data.h === 1) {
        // If banner sizes are 1x1 we set our default size object to 1x1
        returnedSizes = {
          width: 1,
          height: 1
        };
      }

      const regexNoAd = /no ad/gmi;
      const bidResponse = {
        requestId: serverResponse.body.request_id || '',
        cpm: serverResponse.body.cpm || 0,
        width: returnedSizes.width,
        height: returnedSizes.height,
        creativeId: 1,
        dealId: 1,
        currency: serverResponse.body.currency || 'USD',
        netRevenue: true,
        ttl: 600,
        ad: serverResponse.body.ad || '',
      };

      if (!response.timeout && !bidResponse.ad.match(regexNoAd) && response.cpm) {
        bidResponses.push(bidResponse);
      }
    }

    return bidResponses;
  },
};

registerBidder(spec);
