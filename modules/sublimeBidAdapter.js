import { registerBidder } from 'src/adapters/bidderFactory';

const BIDDER_CODE = 'sublime';
const DEFAULT_BID_HOST = 'pbjs.ayads.co';
const DEFAULT_SAC_HOST = 'sac.ayads.co.local';
const DEFAULT_CALLBACK_NAME = 'sublime_prebid_callback';

export const spec = {
  code: BIDDER_CODE,
  aliases: ['sskz', 'sublime-skinz'],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function(bid) {
    console.log(bid);
    return !!bid.params.zoneId;
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @return ServerRequest Info describing the request to the server.
   * @param {validBidRequests[]}  an array of bids
   */
  buildRequests: function(validBidRequests) {
    let params = validBidRequests[0].params || {};
    let requestId = validBidRequests[0].bidId || '';
    let sacHost = params.sacHost || DEFAULT_SAC_HOST;
    let bidHost = params.bidHost || DEFAULT_BID_HOST;
    let zoneId = params.zoneId || DEFAULT_ZONE_ID;
    let callbackName = params.callbackName || DEFAULT_CALLBACK_NAME;

    window[callbackName] = function(response) {
      console.log('sublime callback', response);
      var xhr = new XMLHttpRequest();
      var url = 'https://' + bidHost + '/notify'
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send(
        'notify=1' +
        '&request_id=' + encodeURIComponent(requestId) +
        '&ad=' + encodeURIComponent(response.ad || '') +
        '&cpm=' + encodeURIComponent(response.cpm || 0)
      );
    };
    let script = document.createElement('script');
    script.type = 'application/javascript';
    script.src = 'https://' + sacHost + '/sublime/' + zoneId + '/prebid?callback=' + callbackName;
    document.body.appendChild(script);

    return {
      method: 'GET',
      url: bidHost + '/bid',
      data: {
        prebid: 1,
        request_id: requestId,
      }
    };
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {*} serverResponse A successful response from the server.
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function(serverResponse) {
    const bidResponses = [];
    const bidResponse = {
      requestId: serverResponse.body.request_id || '',
      cpm: serverResponse.body.cpm || 0,
      width: 1800,
      height: 1000,
      creativeId: 1,
      dealId: 1,
      currency: serverResponse.body.currency || 'USD',
      netRevenue: true,
      ttl: 600,
      referrer: '',
      ad: serverResponse.body.ad || '',
    };
    if (bidResponse.cpm) {
      bidResponses.push(bidResponse);
    }
    return bidResponses;
  },

  /**
   * User syncs.
   *
   * @param {*} syncOptions Publisher prebid configuration.
   * @param {*} serverResponses A successful response from the server.
   * @return {Syncs[]} An array of syncs that should be executed.
   */
  getUserSyncs: function(syncOptions, serverResponses) {}
}

registerBidder(spec);
