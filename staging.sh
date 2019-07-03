#!/bin/bash
PATHTOPREBIDJS="/Users/leo/Workspace/Sublime/Prebid.js"
PATHTOEMILBUS="/Users/leo/Workspace/Sublime/Emilbus"
# BRANCHDEBUG="sublime-adapter-debug"
# BRANCH="sublime-adapter"
 
cd $PATHTOPREBIDJS
 
# git checkout $BRANCHDEBUG
# sac/resources/test-display/prebidjs/prebid.js
gulp build --modules=sublimeBidAdapter
cp $PATHTOPREBIDJS/build/dist/prebid.js $PATHTOEMILBUS/sac/resources/test-display/prebidjs/prebid.js
 
# sac/resources/test-display/prebidjs/prebid-gdpr.js
gulp build --modules=sublimeBidAdapter,consentManagement
cp $PATHTOPREBIDJS/build/dist/prebid.js $PATHTOEMILBUS/sac/resources/test-display/prebidjs/prebid-gdpr.js
 
# test-sites/Publisher/hb/prebid.js
gulp build --modules=sublimeBidAdapter,appnexusBidAdapter
cp $PATHTOPREBIDJS/build/dist/prebid.js $PATHTOEMILBUS/test-sites/Publisher/hb/prebid-debug.js
 
#git checkout $BRANCH
# test-sites/Publisher/hb/prebid.js
#gulp build --modules=sublimeBidAdapter,appnexusBidAdapter
#cp $PATHTOPREBIDJS/build/dist/prebid.js $PATHTOEMILBUS/test-sites/Publisher/hb/prebid.js
 
echo "Build done!"
