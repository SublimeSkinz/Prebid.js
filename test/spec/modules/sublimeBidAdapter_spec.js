import { expect } from 'chai';
import { spec } from 'modules/sublimeBidAdapter';
import { newBidder } from 'src/adapters/bidderFactory';

describe('Sublime Adapter', () => {
  const adapter = newBidder(spec);

  describe('inherited functions', () => {
    it('exists and is a function', () => {
      expect(adapter.callBids).to.exist.and.to.be.a('function');
    });
  });

  describe('isBidRequestValid', () => {
    let bid = {
      bidder: 'sublime',
      params: {
        zoneId: 24549,
        endpoint: '',
        sacHost: 'sac.ayads.co',
      },
    };

    it('should return true when required params found', () => {
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('should return false when required params are not passed', () => {
      let bid = Object.assign({}, bid);
      bid.params = {};
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', () => {
    let bidRequests = [
      {
        bidder: 'sublime',
        adUnitCode: 'sublime_code',
        bidId: 'abc1234',
        sizes: [[1800, 1000], [640, 300]],
        requestId: 'xyz654',
        params: {
          zoneId: 23651,
          callbackName: 'false'
        }
      }, {
        bidder: 'sublime',
        adUnitCode: 'sublime_code_2',
        bidId: 'abc1234_2',
        sizes: [[1800, 1000], [640, 300]],
        requestId: 'xyz654_2',
        params: {
          zoneId: 23651,
          callbackName: 'false'
        }
      }
    ];

    let bidderRequest = {
      gdprConsent: {
        consentString: 'EOHEIRCOUCOUIEHZIOEIU-TEST',
        gdprApplies: true
      }
    };

    let request = spec.buildRequests(bidRequests, bidderRequest);

    it('should have a get method', () => {
      expect(request.method).to.equal('GET');
    });

    it('should contains window.sublime.gdpr.injected', () => {
      expect(window.sublime).to.not.be.undefined;
      expect(window.sublime.gdpr).to.not.be.undefined;
      expect(window.sublime.gdpr.injected).to.eql({
        consentString: bidderRequest.gdprConsent.consentString,
        gdprApplies: bidderRequest.gdprConsent.gdprApplies
      });
    });

    it('should contains a request id equals to the bid id', () => {
      expect(request.data.request_id).to.equal(bidRequests[0].bidId);
    });

    it('should have an url that contains bid keyword', () => {
      expect(request.url).to.match(/bid/);
    });
  });

  describe('buildRequests: default arguments', () => {
    let bidRequests = [{
      bidder: 'sublime',
      adUnitCode: 'sublime_code',
      bidId: 'abc1234',
      sizes: [[1800, 1000], [640, 300]],
      requestId: 'xyz654',
      params: {
        zoneId: 23651
      }
    }];

    let request = spec.buildRequests(bidRequests);

    it('should have an url that match the default endpoint', () => {
      expect(request.url).to.equal('https://pbjs.sskzlabs.com/bid');
    });
  });

  describe('interpretResponse', () => {
    let serverResponse = {
      'request_id': '3db3773286ee59',
      'cpm': 0.5,
      'ad': '<!-- Creative -->',
    };

    it('should get correct bid response', () => {
      // Mock the fire method
      top.window.sublime = {
        analytics: {
          fire: function() {}
        }
      };

      let expectedResponse = [
        {
          requestId: '',
          cpm: 0.5,
          width: 1800,
          height: 1000,
          creativeId: 1,
          dealId: 1,
          currency: 'USD',
          netRevenue: true,
          ttl: 600,
          referrer: '',
          ad: '',
        },
      ];
      let result = spec.interpretResponse({body: serverResponse});
      expect(Object.keys(result[0])).to.have.members(Object.keys(expectedResponse[0]));
    });

    it('should get empty bid responses', () => {
      let serverResponse = {};
      let result = spec.interpretResponse({body: serverResponse});
      expect(result).to.deep.equal([]);
    });
  });

  describe('getUserSyncs', () => {
    it('should return an empty array', () => {
      let syncs = spec.getUserSyncs();
      expect(syncs).to.be.an('array').that.is.empty;
    });
  });
});
