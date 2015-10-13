cmd_Release/debug.node := ln -f "Release/obj.target/debug.node" "Release/debug.node" 2>/dev/null || (rm -rf "Release/debug.node" && cp -af "Release/obj.target/debug.node" "Release/debug.node")
