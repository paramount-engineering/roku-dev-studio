' Roku Dev Studio Showcase — MainScene
'
' Grid -> Details/Player flow for capturing RDS screenshots/GIFs, plus the
' App Connector contract (GetExternalControlFunctions / ExecuteFunction) that
' TrackerTask.xml calls into (see roku-components/README.md for the wire
' format). Catalog data defaults to the bundled pkg:/data/catalog.json and
' is only fetched over the network when LoadCatalogFromUrl is called.

sub init()
    m.tilePositions = [
        { x: 60, y: 172 }, { x: 60, y: 278 }, { x: 60, y: 384 }, { x: 60, y: 490 },
        { x: 60, y: 596 }, { x: 60, y: 702 }, { x: 60, y: 808 }, { x: 60, y: 914 }
    ]
    m.tileLabels = [
        m.top.findNode("tileLabel0"), m.top.findNode("tileLabel1"), m.top.findNode("tileLabel2"), m.top.findNode("tileLabel3"),
        m.top.findNode("tileLabel4"), m.top.findNode("tileLabel5"), m.top.findNode("tileLabel6"), m.top.findNode("tileLabel7")
    ]
    m.tileDescs = [
        m.top.findNode("tileDesc0"), m.top.findNode("tileDesc1"), m.top.findNode("tileDesc2"), m.top.findNode("tileDesc3"),
        m.top.findNode("tileDesc4"), m.top.findNode("tileDesc5"), m.top.findNode("tileDesc6"), m.top.findNode("tileDesc7")
    ]
    m.focusHighlight = m.top.findNode("focusHighlight")
    m.statusLabel = m.top.findNode("statusLabel")

    m.connectorHintText = m.top.findNode("connectorHintText")
    m.connectorHintTimer = m.top.findNode("connectorHintTimer")
    m.connectorHintFadeOut = m.top.findNode("connectorHintFadeOut")
    m.connectorHintFadeIn = m.top.findNode("connectorHintFadeIn")
    m.connectorHintTimer.observeField("fire", "OnConnectorHintTimerFire")
    m.connectorHintFadeOut.observeField("state", "OnConnectorFadeOutState")
    m.connectorHints = []
    m.connectorHintIndex = 0

    m.playerGroup = m.top.findNode("playerGroup")
    m.playerVideo = m.top.findNode("playerVideo")
    m.playerTitle = m.top.findNode("playerTitle")
    m.playerDescription = m.top.findNode("playerDescription")
    m.playerState = m.top.findNode("playerState")
    m.playerProgressFill = m.top.findNode("playerProgressFill")
    m.playerTime = m.top.findNode("playerTime")
    m.playerVideo.observeField("state", "OnVideoStateChange")
    m.playerVideo.observeField("position", "OnVideoPositionChange")

    m.catalog = []
    m.focusIndex = 0
    m.currentItem = invalid
    m.playbackState = "stopped"

    ' Debug network proxy (Charles/Fiddler/mitmproxy-style capture, port 8888 by
    ' default) — see SetProxy()/ApplyProxy() below.
    m.proxyHost = invalid
    m.proxyPort = 8888
    m.proxyEnabled = false
    m.proxyVerified = false

    ' Generic async worker (see HelperTask.brs) — does the catalog fetch and
    ' proxy reachability check off the render thread; results land on
    ' `output`, observed here rather than routed through source/main.brs.
    m.helperTask = CreateObject("roSGNode", "HelperTask")
    m.helperTask.control = "RUN"
    m.helperTask.observeField("output", "OnHelperTaskOutput")

    m.top.setFocus(true)
end sub

' Called from source/main.brs once the first frame is on screen.
function _rdsShowcase_start() as void
    m.trackerTask = CreateObject("roSGNode", "TrackerTask")
    m.trackerTask.control = "RUN"
    print "[SHOWCASE] TrackerTask started (App Connector / RALE on port 49200)"

    LoadDefaultCatalog()
    RenderGrid()
    UpdateFocusHighlight()
    StartConnectorHintCarousel()
end function

' Routes HelperTask's `output` by operation — one Task instance handles both
' the catalog fetch and the proxy reachability check (see HelperTask.brs).
sub OnHelperTaskOutput(event as object)
    output = event.GetData()
    if output = invalid or output.operation = invalid then return

    if output.operation = "FetchJson" then
        if output.tag = "healthcheck" then
            OnHealthCheckResult(output)
        else if output.tag = "simulate-error" then
            OnSimulatedErrorResult(output)
        else
            OnCatalogFetchResult(output)
        end if
    else if output.operation = "PostJson" then
        OnTelemetryResult(output)
    else if output.operation = "TestReachable" then
        OnProxyTestResult(output)
    end if
end sub

sub OnCatalogFetchResult(output as object)
    if output.success = true and output.data <> invalid and output.data.items <> invalid then
        m.catalog = output.data.items
        print "[SHOWCASE] Loaded " + m.catalog.Count().ToStr() + " catalog items over HTTPS"
        m.statusLabel.text = ""
    else if output.error <> invalid then
        print "[SHOWCASE] Catalog fetch failed: " + output.error
        m.statusLabel.text = "Catalog load failed (" + output.error + ")"
    else
        print "[SHOWCASE] Catalog fetch failed with HTTP " + output.responseCode.ToStr() + " — keeping the current catalog"
        m.statusLabel.text = "Catalog load failed (HTTP " + output.responseCode.ToStr() + ")"
    end if
    RenderGrid()
end sub

' ===== Network Inspector demo traffic =====
' Three deliberate HTTPS calls (via HelperTask, same pattern as the catalog
' fetch) so Network Inspector always has something fresh to capture even
' without touching LoadCatalogFromUrl: a plain GET, a POST with a JSON body,
' and a request that deliberately comes back as an HTTP error.

sub OnHealthCheckResult(output as object)
    if output.success = true then
        print "[SHOWCASE] Health check OK (HTTP " + output.responseCode.ToStr() + ")"
        m.statusLabel.text = "Health check OK (HTTP " + output.responseCode.ToStr() + ")"
    else if output.error <> invalid then
        print "[SHOWCASE] Health check failed to start: " + output.error
        m.statusLabel.text = "Health check failed to start"
    else
        print "[SHOWCASE] Health check returned HTTP " + output.responseCode.ToStr()
        m.statusLabel.text = "Health check returned HTTP " + output.responseCode.ToStr()
    end if
end sub

sub OnTelemetryResult(output as object)
    if output.success = true then
        print "[SHOWCASE] Telemetry POST accepted (HTTP " + output.responseCode.ToStr() + ")"
        m.statusLabel.text = "Telemetry sent (HTTP " + output.responseCode.ToStr() + ")"
    else if output.error <> invalid then
        print "[SHOWCASE] Telemetry POST failed to start: " + output.error
        m.statusLabel.text = "Telemetry failed to start"
    else
        print "[SHOWCASE] Telemetry POST returned HTTP " + output.responseCode.ToStr()
        m.statusLabel.text = "Telemetry returned HTTP " + output.responseCode.ToStr()
    end if
end sub

' `output.success` is intentionally false here whenever the server actually
' answered with a non-2xx code — that's the expected/desired outcome for
' this demo, not a real failure, so we log it plainly rather than as an error.
sub OnSimulatedErrorResult(output as object)
    if output.error <> invalid then
        print "[SHOWCASE] Simulated error request failed to start: " + output.error
        m.statusLabel.text = "Simulated error request failed to start"
        return
    end if
    print "[SHOWCASE] Simulated network error request returned HTTP " + output.responseCode.ToStr() + " (expected — Network Inspector should show this as a failed request)"
    m.statusLabel.text = "Simulated error: HTTP " + output.responseCode.ToStr()
end sub

' Bundled default catalog, shipped as pkg:/data/catalog.json (same
' { items: [...] } shape as the network catalog) so it can be edited without
' touching this file — see ClientApp/README.md. Its streams are real,
' playable HTTPS MP4s from long-standing public test-media hosts (W3C's own
' media.w3.org test set, video.js's demo CDN, and test-videos.co.uk) —
' verified reachable directly, unlike the old Google gtv-videos-bucket URLs,
' which now 403. Only 4 distinct source films are available across these
' hosts, so Big Buck Bunny and Sintel each appear as a movie/trailer/clip
' trio at different resolutions.
sub LoadDefaultCatalog()
    parsed = ParseJson(ReadAsciiFile("pkg:/data/catalog.json"))
    if parsed <> invalid and parsed.items <> invalid then
        m.catalog = parsed.items
    else
        print "[SHOWCASE] pkg:/data/catalog.json missing or invalid"
        m.catalog = []
    end if
end sub

' Starts an async fetch of a catalog JSON document (same { items: [...] }
' shape as pkg:/data/catalog.json) from `url`, via HelperTask. The result
' lands on OnCatalogFetchResult() through OnHelperTaskOutput().
sub StartCatalogFetch(url as string)
    m.helperTask.input = { operation: "FetchJson", url: ApplyProxy(url) }
end sub

' GET https://postman-echo.com/get — a plain, fast JSON GET with no side
' effects. Result lands on OnHealthCheckResult() via OnHelperTaskOutput().
function PingHealthCheck() as object
    proxyDesc = ProxyDescription()
    m.helperTask.input = { operation: "FetchJson", url: ApplyProxy("https://postman-echo.com/get?source=roku-dev-studio-showcase"), tag: "healthcheck" }
    print "[SHOWCASE] Sent health-check GET to postman-echo.com (proxy: " + proxyDesc + ")"
    return { success: true, proxy: proxyDesc }
end function

' POST https://postman-echo.com/post with a small JSON body — gives Network
' Inspector a request body to show, not just headers/response. Result lands
' on OnTelemetryResult() via OnHelperTaskOutput().
function SubmitTelemetryEvent(eventName as string) as object
    name = eventName
    if name = invalid or name = "" then name = "demo_event"
    proxyDesc = ProxyDescription()
    body = FormatJson({ event: name, source: "roku-dev-studio-showcase", model: CreateObject("roDeviceInfo").GetModel() })
    m.helperTask.input = { operation: "PostJson", url: ApplyProxy("https://postman-echo.com/post"), body: body, tag: "telemetry" }
    print "[SHOWCASE] Sent telemetry POST: " + name + " (proxy: " + proxyDesc + ")"
    return { success: true, event: name, proxy: proxyDesc }
end function

' GET https://postman-echo.com/status/500 — deliberately comes back non-2xx
' so Network Inspector has a failed request to show, not just successes.
' Result lands on OnSimulatedErrorResult() via OnHelperTaskOutput().
function SimulateNetworkError() as object
    proxyDesc = ProxyDescription()
    m.helperTask.input = { operation: "FetchJson", url: ApplyProxy("https://postman-echo.com/status/500"), tag: "simulate-error" }
    print "[SHOWCASE] Requesting a simulated HTTP 500 for the Network Inspector demo (proxy: " + proxyDesc + ")"
    return { success: true, proxy: proxyDesc }
end function

' ===== Debug network proxy =====
' Routes outgoing traffic (catalog fetches, stream URLs) through a
' Charles/Fiddler/mitmproxy-style capture tool on the developer's machine —
' Roku has no OS-level HTTP proxy setting and doesn't support installing a
' MITM root cert, so every URL has to be rewritten by hand to
' "http://<host>:8888/;<realUrl>" and let that tool fetch-and-forward.
' See SetProxy() (App Connector) for how this gets turned on.

' Rewrites `url` to go through the configured proxy, but only once it has
' been verified reachable — see StartProxyTest()/OnProxyTestResult(). This
' keeps a laptop being off the network from silently breaking catalog loads
' or playback.
function ApplyProxy(url as string) as string
    if url = invalid or url = "" then return url
    if not m.proxyEnabled or not m.proxyVerified or m.proxyHost = invalid or m.proxyHost = "" then return url
    return "http://" + m.proxyHost + ":" + m.proxyPort.ToStr() + "/;" + url
end function

' Same effective-state check as ApplyProxy() itself, as a human-readable
' string — so every network op's print/result can say plainly which path a
' request actually took ("direct" vs "<host>:<port>") instead of leaving it
' implicit.
function ProxyDescription() as string
    if not m.proxyEnabled or not m.proxyVerified or m.proxyHost = invalid or m.proxyHost = "" then return "direct"
    return m.proxyHost + ":" + m.proxyPort.ToStr()
end function

' Sets (or clears) the debug proxy host/port. Enabling kicks off an async
' reachability test before the proxy is actually used (ApplyProxy stays a
' no-op until m.proxyVerified flips true); disabling clears it immediately.
' port defaults to 8888 (the Charles/Fiddler/mitmproxy-style capture tools'
' usual default) when the caller doesn't pass one.
function SetProxy(host as string, enable as boolean, port = 8888 as integer) as object
    if enable and (host = invalid or host = "") then
        return { success: false, error: "host is required to enable the proxy" }
    end if
    if port = invalid or port <= 0 then port = 8888

    m.proxyHost = host
    m.proxyPort = port
    m.proxyEnabled = enable
    m.proxyVerified = false

    if enable then
        print "[SHOWCASE] Verifying proxy at " + host + ":" + port.ToStr() + "..."
        m.statusLabel.text = "Verifying proxy at " + host + ":" + port.ToStr() + "..."
        StartProxyTest(host, port)
    else
        print "[SHOWCASE] Proxy disabled"
        m.statusLabel.text = ""
    end if
    return { success: true, host: host, port: port, enabled: enable, verified: m.proxyVerified }
end function

' Starts an async reachability check of `host:port` by routing a lightweight
' request (a well-known 204 endpoint) through it via HelperTask, the same
' way ApplyProxy() would route real traffic. The result lands on
' OnProxyTestResult() through OnHelperTaskOutput().
sub StartProxyTest(host as string, port as integer)
    testUrl = "http://" + host + ":" + port.ToStr() + "/;https://www.google.com/generate_204"
    m.helperTask.input = { operation: "TestReachable", url: testUrl }
end sub

sub OnProxyTestResult(output as object)
    if output.error <> invalid then
        m.proxyEnabled = false
        m.proxyVerified = false
        print "[SHOWCASE] Proxy test failed to start: " + output.error
        m.statusLabel.text = "Proxy request failed to start"
        return
    end if

    m.proxyVerified = (output.reachable = true)
    if m.proxyVerified then
        print "[SHOWCASE] Proxy at " + m.proxyHost + ":" + m.proxyPort.ToStr() + " is reachable"
        m.statusLabel.text = "Proxy enabled: " + m.proxyHost + ":" + m.proxyPort.ToStr()
    else
        m.proxyEnabled = false
        print "[SHOWCASE] Proxy at " + m.proxyHost + ":" + m.proxyPort.ToStr() + " is unreachable — disabling"
        m.statusLabel.text = "Proxy unreachable — disabled"
    end if
end sub

' ===== Device / memory diagnostics =====

' roDeviceInfo diagnostics — model, OS version, network/display info. Cheap,
' synchronous, no HelperTask needed (GetExternalIp() does its own brief
' network round-trip internally, same as the reference app calls it).
function GetDeviceInfo() as object
    di = CreateObject("roDeviceInfo")
    osVersion = di.GetOSVersion()
    uiResolution = di.GetUIResolution()
    return {
        success: true,
        model: di.GetModel(),
        modelDisplayName: di.GetModelDisplayName(),
        modelType: di.GetModelType(),
        osVersion: osVersion.major + "." + osVersion.minor + "." + osVersion.revision + " (build " + osVersion.build + ")",
        clientId: di.GetChannelClientId(),
        localIp: di.GetConnectionInfo().ip,
        externalIp: di.GetExternalIp(),
        connectionType: di.GetConnectionType(),
        displayType: di.GetDisplayType(),
        displayMode: di.GetDisplayMode(),
        displayAspectRatio: di.GetDisplayAspectRatio(),
        uiResolution: uiResolution.width.ToStr() + "x" + uiResolution.height.ToStr(),
        timeZone: di.GetTimeZone(),
        countryCode: di.GetUserCountryCode()
    }
end function

' roAppMemoryMonitor diagnostics — the channel's memory limits/usage, plus
' the device's overall memory pressure level. Good "why did my channel just
' get killed" debug tool.
function GetMemoryInfo() as object
    mm = CreateObject("roAppMemoryMonitor")
    limits = mm.GetChannelMemoryLimit()
    return {
        success: true,
        maxForegroundMemory: limits.maxForegroundMemory,
        maxBackgroundMemory: limits.maxBackgroundMemory,
        maxRokuManagedHeapMemory: limits.maxRokuManagedHeapMemory,
        availableMemory: mm.GetChannelAvailableMemory(),
        usagePercent: mm.GetMemoryLimitPercent(),
        generalMemoryLevel: CreateObject("roDeviceInfo").GetGeneralMemoryLevel()
    }
end function

' ===== Console Monitor demo triggers =====
' Deliberately trips real BrightScript runtime errors, each wrapped in its
' own try/catch so the channel never actually crashes, then prints the
' caught exception's own (real, engine-provided) message in the standard
' "BRIGHTSCRIPT: ERROR: <message>: <file>(<marker>)" console format so
' RDS's Console Monitor recognizes each one as a genuine finding — these are
' real runtime errors, not fabricated text; try/catch only stops them from
' halting the script.
function TriggerConsoleFinding(kind as string) as object
    want = LCase(kind)
    triggered = []

    if want = "" or want = "all" or want = "type-mismatch" then
        try
            dummy = "5" + { a: 1 }
        catch e
            PrintConsoleFinding(e, "type-mismatch")
            triggered.Push("type-mismatch")
        end try
    end if

    if want = "" or want = "all" or want = "for-each" then
        try
            for each item in 42
                print item
            end for
        catch e
            PrintConsoleFinding(e, "for-each")
            triggered.Push("for-each")
        end try
    end if

    if want = "" or want = "all" or want = "dot-invalid" then
        try
            missing = invalid
            dummy = missing.someField
        catch e
            PrintConsoleFinding(e, "dot-invalid")
            triggered.Push("dot-invalid")
        end try
    end if

    if want = "" or want = "all" or want = "divide-zero" then
        try
            dummy = 5 MOD 0
        catch e
            PrintConsoleFinding(e, "divide-zero")
            triggered.Push("divide-zero")
        end try
    end if

    if want = "" or want = "all" or want = "array-out-of-bounds" then
        try
            dim fixedArr[3]
            dummy = fixedArr[99]
        catch e
            PrintConsoleFinding(e, "array-out-of-bounds")
            triggered.Push("array-out-of-bounds")
        end try
    end if

    if want = "" or want = "all" or want = "invalid-format-specifier" then
        try
            dummy = (5).ToStr("q")
        catch e
            PrintConsoleFinding(e, "invalid-format-specifier")
            triggered.Push("invalid-format-specifier")
        end try
    end if

    if want = "" or want = "all" or want = "bad-throw" then
        try
            throw 12345
        catch e
            PrintConsoleFinding(e, "bad-throw")
            triggered.Push("bad-throw")
        end try
    end if

    ' SceneGraph/Component — a wrong-type field assignment on a real node.
    if want = "" or want = "all" or want = "sg-field-type-mismatch" then
        try
            m.focusHighlight.width = "not-a-number"
        catch e
            PrintConsoleFinding(e, "sg-field-type-mismatch")
            triggered.Push("sg-field-type-mismatch")
        end try
    end if

    ' SceneGraph/Component — setting a field the node type never declared.
    ' Non-fatal (the runtime just ignores the set and prints its own
    ' WARNING block), so no try/catch is needed here.
    if want = "" or want = "all" or want = "sg-nonexistent-field" then
        m.focusHighlight.rdsShowcaseBogusField = true
        print "[SHOWCASE] Triggered sg-nonexistent-field (see the WARNING the runtime just printed above)"
        triggered.Push("sg-nonexistent-field")
    end if

    ' SceneGraph/Component — a node whose child is itself creates a cycle
    ' in the render tree.
    if want = "" or want = "all" or want = "sg-node-loop-detected" then
        try
            loopNode = CreateObject("roSGNode", "Group")
            loopNode.appendChild(loopNode)
        catch e
            PrintConsoleFinding(e, "sg-node-loop-detected")
            triggered.Push("sg-node-loop-detected")
        end try
    end if

    ' JSON — a circular reference FormatJSON can't serialize.
    if want = "" or want = "all" or want = "formatjson-nested" then
        try
            cyclic = {}
            cyclic.self = cyclic
            dummy = FormatJson(cyclic)
        catch e
            PrintConsoleFinding(e, "formatjson-nested")
            triggered.Push("formatjson-nested")
        end try
    end if

    ' JSON — ParseJSON on empty input. Non-fatal (returns invalid and the
    ' runtime prints its own ERROR line), so no try/catch is needed here.
    if want = "" or want = "all" or want = "parsejson-failed" then
        dummy = ParseJson("")
        print "[SHOWCASE] Triggered parsejson-failed (see the ERROR the runtime just printed above)"
        triggered.Push("parsejson-failed")
    end if

    ' File I/O — pkg:/ is read-only, so any write there fails. Non-fatal
    ' (returns false and the runtime prints its own ERROR line), so no
    ' try/catch is needed here.
    if want = "" or want = "all" or want = "file-write-failed" then
        dummy = WriteAsciiFile("pkg:/rds-showcase-should-fail.txt", "x")
        print "[SHOWCASE] Triggered file-write-failed (see the ERROR the runtime just printed above)"
        triggered.Push("file-write-failed")
    end if

    if triggered.Count() = 0 then
        return { success: false, error: "Unknown kind: " + kind + " (expected all, or one of: type-mismatch, for-each, dot-invalid, divide-zero, array-out-of-bounds, invalid-format-specifier, bad-throw, sg-field-type-mismatch, sg-nonexistent-field, sg-node-loop-detected, formatjson-nested, parsejson-failed, file-write-failed)" }
    end if
    return { success: true, triggered: triggered }
end function

sub PrintConsoleFinding(e as dynamic, marker as string)
    message = "Unknown error"
    if e <> invalid and GetInterface(e, "ifAssociativeArray") <> invalid and e.message <> invalid then
        message = e.message
    end if
    print "BRIGHTSCRIPT: ERROR: " + message + ": pkg:/components/MainScene.brs(showcase-demo:" + marker + ")"
end sub

sub RenderGrid()
    for i = 0 to m.tileLabels.Count() - 1
        label = m.tileLabels[i]
        desc = m.tileDescs[i]
        if i < m.catalog.Count() then
            item = m.catalog[i]
            label.text = item.title
            desc.text = item.description
            label.visible = true
            desc.visible = true
        else
            label.visible = false
            desc.visible = false
        end if
    end for
end sub

' ===== Grid navigation =====

sub UpdateFocusHighlight()
    tilePos = m.tilePositions[m.focusIndex]
    m.focusHighlight.translation = [tilePos.x - 8, tilePos.y - 8]
end sub

sub MoveFocus(delta as integer)
    count = m.catalog.Count()
    if count = 0 then return
    newIndex = m.focusIndex + delta
    if newIndex < 0 then newIndex = 0
    if newIndex > count - 1 then newIndex = count - 1
    if newIndex > 7 then newIndex = 7
    m.focusIndex = newIndex
    UpdateFocusHighlight()
end sub

' ===== Details / Player =====

sub OpenPlayer(item as object)
    m.currentItem = item
    m.playbackState = "playing"

    content = CreateObject("roSGNode", "ContentNode")
    content.url = ApplyProxy(item.streamUrl)
    content.streamFormat = item.streamFormat
    content.title = item.title

    m.playerTitle.text = item.title
    m.playerDescription.text = item.description
    m.playerVideo.content = content
    m.playerVideo.control = "play"
    m.playerGroup.visible = true
    RenderPlayerState()
    print "[SHOWCASE] Playing '" + item.title + "' (proxy: " + ProxyDescription() + ")"
end sub

sub ClosePlayer()
    m.playerVideo.control = "stop"
    m.playerGroup.visible = false
end sub

sub RenderPlayerState()
    if m.currentItem = invalid then return
    m.playerState.text = UCase(m.playbackState)
    duration = m.playerVideo.duration
    position = m.playerVideo.position
    pct = 0
    if duration > 0 then pct = position / duration
    if pct > 1 then pct = 1
    m.playerProgressFill.width = 1760 * pct
    m.playerTime.text = SecondsToClock(position) + " / " + SecondsToClock(duration)
end sub

sub OnVideoStateChange(event as object)
    videoState = event.GetData()
    if videoState = "playing" or videoState = "buffering" then
        m.playbackState = "playing"
    else if videoState = "paused" then
        m.playbackState = "paused"
    else
        m.playbackState = "stopped"
    end if
    RenderPlayerState()
end sub

sub OnVideoPositionChange(event as object)
    RenderPlayerState()
end sub

function SecondsToClock(totalSeconds as integer) as string
    mins = Int(totalSeconds / 60)
    secs = totalSeconds - (mins * 60)
    secStr = secs.ToStr()
    if Len(secStr) < 2 then secStr = "0" + secStr
    return mins.ToStr() + ":" + secStr
end function

' ===== Remote control =====

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if m.playerGroup.visible then
        if key = "back" then
            ClosePlayer()
            return true
        else if key = "play" then
            if m.playbackState = "playing" then
                m.playbackState = "paused"
                m.playerVideo.control = "pause"
            else
                if m.playbackState = "stopped" then
                    m.playerVideo.control = "play"
                else
                    m.playerVideo.control = "resume"
                end if
                m.playbackState = "playing"
            end if
            RenderPlayerState()
            return true
        else if key = "rewind" then
            newPosition = m.playerVideo.position - 10
            if newPosition < 0 then newPosition = 0
            m.playerVideo.seek = newPosition
            return true
        else if key = "fastforward" then
            newPosition = m.playerVideo.position + 10
            if m.playerVideo.duration > 0 and newPosition > m.playerVideo.duration then
                newPosition = m.playerVideo.duration
            end if
            m.playerVideo.seek = newPosition
            return true
        end if
        return false
    end if

    if key = "up" then
        MoveFocus(-1)
        return true
    else if key = "down" then
        MoveFocus(1)
        return true
    else if key = "OK" then
        if m.focusIndex < m.catalog.Count() then
            OpenPlayer(m.catalog[m.focusIndex])
        end if
        return true
    end if
    return false
end function

' ===== App Connector hint carousel =====
' Cycles the header's top-right space through GetExternalControlFunctions()'s
' own list (name + description), fading the label out/in on each swap — a
' live read of the exact contract App Connector clients see, not a
' hand-maintained duplicate that could drift as functions are added below.

sub StartConnectorHintCarousel()
    m.connectorHints = GetExternalControlFunctions()
    if m.connectorHints.Count() = 0 then return
    m.connectorHintIndex = 0
    m.connectorHintText.text = FormatConnectorHint(m.connectorHints[0])
    m.connectorHintTimer.control = "start"
end sub

sub OnConnectorHintTimerFire()
    m.connectorHintFadeOut.control = "start"
end sub

sub OnConnectorFadeOutState()
    if m.connectorHintFadeOut.state <> "stopped" then return
    m.connectorHintIndex = (m.connectorHintIndex + 1) MOD m.connectorHints.Count()
    m.connectorHintText.text = FormatConnectorHint(m.connectorHints[m.connectorHintIndex])
    m.connectorHintFadeIn.control = "start"
end sub

' "FnName — first ~64 chars of its description…", cut at a word boundary
' (not mid-word) when the description runs long.
function FormatConnectorHint(fn as object) as string
    maxDescLen = 64
    desc = fn.description
    if Len(desc) > maxDescLen then
        cut = Left(desc, maxDescLen)
        spaceIdx = LastIndexOfSpace(cut)
        if spaceIdx > 1 then cut = Left(cut, spaceIdx - 1)
        desc = cut + "…"
    end if
    return fn.name + " — " + desc
end function

function LastIndexOfSpace(s as string) as integer
    for i = Len(s) to 1 step -1
        if Mid(s, i, 1) = " " then return i
    end for
    return 0
end function

' ===== App Connector / RALE contract =====
' See roku-components/README.md — these two functions are called via
' root.callFunc(...) from TrackerTask.xml's UIThread_getExternalControlFunctions
' and UIThread_executeExternalControlFunction.

function GetExternalControlFunctions(args = invalid as dynamic) as object
    return [
        { name: "GetCatalog", description: "Returns the full content catalog.", params: [] }
        { name: "SearchCatalog", description: "Returns catalog items whose title or description contains the query (case-insensitive).", params: [{ name: "query", type: "String", placeholder: "e.g. bunny" }] }
        { name: "PlayContentById", description: "Opens the Details/Player screen for the given content id and starts playback.", params: [{ name: "contentId", type: "String", placeholder: "e.g. big-buck-bunny" }] }
        { name: "SetPlaybackState", description: "Sets playback state on the currently open item. One of: play, pause, stop.", params: [{ name: "state", type: "String", placeholder: "play, pause, or stop" }] }
        { name: "GetPlaybackState", description: "Returns the currently open item's id, title, playback state, and position/duration in seconds.", params: [] }
        { name: "LoadCatalogFromUrl", description: "Starts fetching a new catalog from the given HTTPS URL (JSON shape: { items: [...] }), replacing the current catalog once it arrives.", params: [{ name: "url", type: "String", placeholder: "e.g. https://paramount-engineering.github.io/roku-dev-studio/demo-catalog/catalog.json" }] }
        { name: "SetProxy", description: "Routes catalog/stream requests through a debug proxy (Charles/Fiddler/mitmproxy-style capture) at host:port, verifying it's reachable before use. Pass the proxy host IP, an enable boolean, and an optional port (default 8888).", params: [{ name: "host", type: "String", placeholder: "e.g. 192.168.1.50" }, { name: "enable", type: "Boolean" }, { name: "port", type: "Integer", placeholder: "Default: 8888" }] }
        { name: "GetProxyStatus", description: "Returns the current debug proxy host, port, whether it's enabled, and whether it's been verified reachable.", params: [] }
        { name: "GetDeviceInfo", description: "Returns roDeviceInfo diagnostics: model, OS version, client id, IP addresses, connection type, display info, time zone, country code.", params: [] }
        { name: "GetMemoryInfo", description: "Returns roAppMemoryMonitor diagnostics: channel memory limits, available memory, usage percent, and the device's general memory level.", params: [] }
        { name: "PingHealthCheck", description: "Sends a plain HTTPS GET to postman-echo.com for a quick Network Inspector capture.", params: [] }
        { name: "SubmitTelemetryEvent", description: "Sends an HTTPS POST with a JSON body to postman-echo.com — shows a request body in Network Inspector, not just headers.", params: [{ name: "eventName", type: "String", placeholder: "e.g. video_started" }] }
        { name: "SimulateNetworkError", description: "Sends an HTTPS GET that deliberately returns HTTP 500, so Network Inspector has a failed request to show.", params: [] }
        { name: "TriggerConsoleFinding", description: "Deliberately trips a real, non-fatal BrightScript runtime error/warning so Console Monitor recognizes a finding. kind is optional (default: all, which trips every one) — one of: type-mismatch, for-each, dot-invalid, divide-zero, array-out-of-bounds, invalid-format-specifier, bad-throw, sg-field-type-mismatch, sg-nonexistent-field, sg-node-loop-detected, formatjson-nested, parsejson-failed, file-write-failed.", params: [{ name: "kind", type: "String", placeholder: "Default: all" }] }
    ]
end function

function ExecuteFunction(functionName as string, functionParams = invalid as dynamic) as dynamic
    print "[SHOWCASE] App Connector call: " + functionName

    if functionName = "GetCatalog" then
        return m.catalog

    else if functionName = "SearchCatalog" then
        query = ""
        if functionParams <> invalid and functionParams.Count() > 0 then query = LCase(functionParams[0].ToStr())
        return SearchCatalog(query)

    else if functionName = "PlayContentById" then
        contentId = ""
        if functionParams <> invalid and functionParams.Count() > 0 then contentId = functionParams[0].ToStr()
        item = FindCatalogItemById(contentId)
        if item = invalid then return { success: false, error: "No content with id " + contentId }
        OpenPlayer(item)
        return { success: true, id: item.id, title: item.title, proxy: ProxyDescription() }

    else if functionName = "SetPlaybackState" then
        if m.currentItem = invalid then return { success: false, error: "Nothing is playing" }
        state = ""
        if functionParams <> invalid and functionParams.Count() > 0 then state = LCase(functionParams[0].ToStr())
        if state <> "play" and state <> "pause" and state <> "stop" then
            return { success: false, error: "state must be play, pause, or stop" }
        end if
        if state = "play" then
            if m.playbackState = "stopped" then
                m.playerVideo.control = "play"
            else
                m.playerVideo.control = "resume"
            end if
            m.playbackState = "playing"
        else if state = "pause" then
            m.playbackState = "paused"
            m.playerVideo.control = "pause"
        else
            m.playbackState = "stopped"
            m.playerVideo.control = "stop"
        end if
        RenderPlayerState()
        return { success: true, state: m.playbackState }

    else if functionName = "GetPlaybackState" then
        if m.currentItem = invalid then return { success: false, error: "Nothing is playing" }
        return {
            success: true,
            id: m.currentItem.id,
            title: m.currentItem.title,
            state: m.playbackState,
            positionSeconds: m.playerVideo.position,
            durationSeconds: m.playerVideo.duration
        }

    else if functionName = "LoadCatalogFromUrl" then
        url = ""
        if functionParams <> invalid and functionParams.Count() > 0 then url = functionParams[0].ToStr()
        if url = "" then return { success: false, error: "url is required" }
        proxyDesc = ProxyDescription()
        m.statusLabel.text = "Loading catalog from network..."
        StartCatalogFetch(url)
        print "[SHOWCASE] Loading catalog from " + url + " (proxy: " + proxyDesc + ")"
        return { success: true, url: url, proxy: proxyDesc }

    else if functionName = "SetProxy" then
        host = ""
        if functionParams <> invalid and functionParams.Count() > 0 then host = functionParams[0].ToStr()
        enable = false
        if functionParams <> invalid and functionParams.Count() > 1 then enable = (functionParams[1] = true)
        port = 8888
        if functionParams <> invalid and functionParams.Count() > 2 and functionParams[2] <> invalid then port = functionParams[2]
        return SetProxy(host, enable, port)

    else if functionName = "GetProxyStatus" then
        return { success: true, host: m.proxyHost, port: m.proxyPort, enabled: m.proxyEnabled, verified: m.proxyVerified }

    else if functionName = "GetDeviceInfo" then
        return GetDeviceInfo()

    else if functionName = "GetMemoryInfo" then
        return GetMemoryInfo()

    else if functionName = "PingHealthCheck" then
        return PingHealthCheck()

    else if functionName = "SubmitTelemetryEvent" then
        eventName = ""
        if functionParams <> invalid and functionParams.Count() > 0 then eventName = functionParams[0].ToStr()
        return SubmitTelemetryEvent(eventName)

    else if functionName = "SimulateNetworkError" then
        return SimulateNetworkError()

    else if functionName = "TriggerConsoleFinding" then
        kind = "all"
        if functionParams <> invalid and functionParams.Count() > 0 then 
            if functionParams[0] <> invalid then 
                kind = functionParams[0].ToStr()
            end if
        end if
        return TriggerConsoleFinding(kind)
    end if

    return { success: false, error: "Unknown function: " + functionName }
end function

function FindCatalogItemById(id as string) as dynamic
    for each item in m.catalog
        if item.id = id then return item
    end for
    return invalid
end function

function SearchCatalog(query as string) as object
    if query = "" then return m.catalog
    results = []
    for each item in m.catalog
        if Instr(1, LCase(item.title), query) > 0 or Instr(1, LCase(item.description), query) > 0 then
            results.Push(item)
        end if
    end for
    return results
end function
