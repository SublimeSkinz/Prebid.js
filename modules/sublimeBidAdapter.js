import * as utils from 'src/utils';
import { registerBidder } from 'src/adapters/bidderFactory';
import { config } from 'src/config';

const BIDDER_CODE = 'sublime';

export const spec = {
  code: BIDDER_CODE,
  aliases: ['sskz', 'sublime-skinz'],
  isBidRequestValid: function(bid) {},
  buildRequests: function(validBidRequests, bidderRequest) {},
  interpretResponse: function(serverResponse, request) {},
  getUserSyncs: function(syncOptions, serverResponses) {},
  onTimeout: function(timeoutData) {},
  onBidWon: function(bid) {}
}

registerBidder(spec);
