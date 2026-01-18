import SwiftUI
import AVFoundation

struct ContentView: View {
    @State private var isStreaming = false
    @State private var showChat = false
    @State private var showMonitor = false
    @State private var myUsername = ""
    @State private var monitorUsername = ""
    @State private var serverURL = "https://mirror-stream-io.onrender.com"

    // Rotation settings (applied when starting stream)
    @State private var orientation = "portrait"
    @State private var rotateAngle = "0"
    @State private var mirrorOutput = true

    // The URL used when streaming started (doesn't change mid-stream)
    @State private var activeStreamURL: URL?

    // Chat window position
    @State private var chatOffset = CGSize.zero
    @State private var chatSize = CGSize(width: 300, height: 400)

    // Monitor window position
    @State private var monitorOffset = CGSize(width: 50, height: 100)
    @State private var monitorSize = CGSize(width: 200, height: 150)

    var body: some View {
        ZStack {
            // Background - Camera preview or streaming view
            if isStreaming, let streamURL = activeStreamURL {
                // Show the web streaming interface
                WebView(url: streamURL)
                    .edgesIgnoringSafeArea(.all)
            } else {
                // Setup screen
                setupView
            }

            // Floating Chat Window
            if showChat && !myUsername.isEmpty {
                FloatingWindow(
                    title: "Chat",
                    offset: $chatOffset,
                    size: $chatSize,
                    onClose: { showChat = false }
                ) {
                    FloatingWebView(url: URL(string: "https://chaturbate.com/popout/\(myUsername)/chat/")!)
                }
            }

            // Floating Monitor Window
            if showMonitor && !monitorUsername.isEmpty {
                FloatingWindow(
                    title: "Monitor",
                    offset: $monitorOffset,
                    size: $monitorSize,
                    onClose: { showMonitor = false }
                ) {
                    FloatingWebView(url: URL(string: "https://chaturbate.com/\(monitorUsername)/")!)
                }
            }

            // Controls overlay when streaming
            if isStreaming {
                VStack {
                    Spacer()
                    HStack(spacing: 20) {
                        Button(action: { showChat.toggle() }) {
                            VStack {
                                Image(systemName: showChat ? "message.fill" : "message")
                                    .font(.title2)
                                Text("Chat")
                                    .font(.caption)
                            }
                            .foregroundColor(.white)
                            .padding()
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(10)
                        }

                        Button(action: { showMonitor.toggle() }) {
                            VStack {
                                Image(systemName: showMonitor ? "tv.fill" : "tv")
                                    .font(.title2)
                                Text("Monitor")
                                    .font(.caption)
                            }
                            .foregroundColor(.white)
                            .padding()
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(10)
                        }

                        Button(action: stopStreaming) {
                            VStack {
                                Image(systemName: "xmark.circle")
                                    .font(.title2)
                                Text("Stop")
                                    .font(.caption)
                            }
                            .foregroundColor(.red)
                            .padding()
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(10)
                        }
                    }
                    .padding(.bottom, 30)
                }
            }
        }
        .onAppear {
            loadSettings()
        }
    }

    var setupView: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Mirror Stream")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.white)

                Text("Stream to Chaturbate with mirrored cam")
                    .foregroundColor(.gray)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Server URL")
                        .foregroundColor(.gray)
                        .font(.caption)
                    TextField("https://mirror-stream-io.onrender.com", text: $serverURL)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
                .padding(.horizontal)

                // Rotation Settings
                VStack(alignment: .leading, spacing: 12) {
                    Text("Video Settings")
                        .foregroundColor(.white)
                        .font(.headline)

                    HStack {
                        Text("Orientation:")
                            .foregroundColor(.gray)
                        Picker("Orientation", selection: $orientation) {
                            Text("Portrait").tag("portrait")
                            Text("Landscape").tag("landscape")
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }

                    HStack {
                        Text("Rotation:")
                            .foregroundColor(.gray)
                        Picker("Rotation", selection: $rotateAngle) {
                            Text("0°").tag("0")
                            Text("90°").tag("90")
                            Text("180°").tag("180")
                            Text("270°").tag("270")
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }

                    Toggle("Mirror Output", isOn: $mirrorOutput)
                        .foregroundColor(.gray)
                }
                .padding()
                .background(Color.gray.opacity(0.2))
                .cornerRadius(10)
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Chaturbate Username (for chat)")
                        .foregroundColor(.gray)
                        .font(.caption)
                    TextField("Username", text: $myUsername)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Monitor Username (optional)")
                        .foregroundColor(.gray)
                        .font(.caption)
                    TextField("Username to watch", text: $monitorUsername)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
                .padding(.horizontal)

                Button(action: startStreaming) {
                    Text("GO LIVE")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .cornerRadius(10)
                }
                .padding(.horizontal)
                .padding(.top, 20)

                Text("Note: Chat/Monitor windows may not load\ndue to site restrictions.")
                    .foregroundColor(.gray)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            .padding(.top, 60)
        }
        .background(Color.black.edgesIgnoringSafeArea(.all))
    }

    func startStreaming() {
        saveSettings()

        // Build URL with rotation params
        var urlString = serverURL
        if !urlString.hasSuffix("/") {
            urlString += "/"
        }

        // Add rotation parameters
        let params = [
            "orientation=\(orientation)",
            "rotateAngle=\(rotateAngle)",
            "mirror=\(mirrorOutput ? "1" : "0")"
        ].joined(separator: "&")

        urlString += "?\(params)"

        if let url = URL(string: urlString) {
            activeStreamURL = url
            isStreaming = true
        }
    }

    func stopStreaming() {
        isStreaming = false
        activeStreamURL = nil
        showChat = false
        showMonitor = false
    }

    func saveSettings() {
        UserDefaults.standard.set(serverURL, forKey: "serverURL")
        UserDefaults.standard.set(myUsername, forKey: "myUsername")
        UserDefaults.standard.set(monitorUsername, forKey: "monitorUsername")
        UserDefaults.standard.set(orientation, forKey: "orientation")
        UserDefaults.standard.set(rotateAngle, forKey: "rotateAngle")
        UserDefaults.standard.set(mirrorOutput, forKey: "mirrorOutput")
    }

    func loadSettings() {
        serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? "https://mirror-stream-io.onrender.com"
        myUsername = UserDefaults.standard.string(forKey: "myUsername") ?? ""
        monitorUsername = UserDefaults.standard.string(forKey: "monitorUsername") ?? ""
        orientation = UserDefaults.standard.string(forKey: "orientation") ?? "portrait"
        rotateAngle = UserDefaults.standard.string(forKey: "rotateAngle") ?? "0"
        mirrorOutput = UserDefaults.standard.bool(forKey: "mirrorOutput")
        // Default mirror to true if not set
        if !UserDefaults.standard.dictionaryRepresentation().keys.contains("mirrorOutput") {
            mirrorOutput = true
        }
    }
}

// Floating draggable/resizable window component
struct FloatingWindow<Content: View>: View {
    let title: String
    @Binding var offset: CGSize
    @Binding var size: CGSize
    let onClose: () -> Void
    let content: () -> Content

    @State private var dragOffset = CGSize.zero
    @State private var isResizing = false

    var body: some View {
        VStack(spacing: 0) {
            // Title bar - drag to move
            HStack {
                Text(title)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                Spacer()

                // Size toggle button
                Button(action: cycleSize) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .foregroundColor(.white)
                        .font(.caption)
                }
                .padding(.trailing, 8)

                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.black.opacity(0.9))
            .gesture(
                DragGesture()
                    .onChanged { value in
                        dragOffset = value.translation
                    }
                    .onEnded { value in
                        offset.width += value.translation.width
                        offset.height += value.translation.height
                        dragOffset = .zero
                    }
            )

            // Content
            content()
                .frame(width: size.width, height: size.height)
                .clipped()
        }
        .background(Color.black)
        .cornerRadius(8)
        .shadow(radius: 10)
        .offset(x: offset.width + dragOffset.width, y: offset.height + dragOffset.height)
    }

    func cycleSize() {
        // Cycle through sizes: small -> medium -> large -> small
        if size.width < 250 {
            size = CGSize(width: 300, height: 400)
        } else if size.width < 350 {
            size = CGSize(width: 400, height: 500)
        } else {
            size = CGSize(width: 200, height: 150)
        }
    }
}

#Preview {
    ContentView()
}
