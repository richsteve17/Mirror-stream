import SwiftUI
import AVFoundation

struct ContentView: View {
    @State private var isStreaming = false
    @State private var showChat = false
    @State private var showMonitor = false
    @State private var myUsername = ""
    @State private var monitorUsername = ""
    @State private var serverURL = "https://mirror-stream-io.onrender.com"

    // Chat window position
    @State private var chatOffset = CGSize.zero
    @State private var chatSize = CGSize(width: 300, height: 400)

    // Monitor window position
    @State private var monitorOffset = CGSize(width: 50, height: 100)
    @State private var monitorSize = CGSize(width: 200, height: 150)

    var body: some View {
        ZStack {
            // Background - Camera preview or streaming view
            if isStreaming {
                // Show the web streaming interface
                WebView(url: URL(string: serverURL)!)
                    .edgesIgnoringSafeArea(.all)
            } else {
                // Setup screen
                setupView
            }

            // Floating Chat Window
            if showChat && !myUsername.isEmpty {
                FloatingWindow(
                    title: "My Chat",
                    offset: $chatOffset,
                    size: $chatSize,
                    onClose: { showChat = false }
                ) {
                    WebView(url: URL(string: "https://chaturbate.com/popout/\(myUsername)/chat/")!)
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
                    WebView(url: URL(string: "https://chaturbate.com/\(monitorUsername)/")!)
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

                        Button(action: { isStreaming = false }) {
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
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Chaturbate Username")
                        .foregroundColor(.gray)
                        .font(.caption)
                    TextField("Username for chat", text: $myUsername)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Monitor Username (optional)")
                        .foregroundColor(.gray)
                        .font(.caption)
                    TextField("Username to watch", text: $monitorUsername)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .autocapitalization(.none)
                }
                .padding(.horizontal)

                Button(action: {
                    saveSettings()
                    isStreaming = true
                }) {
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

                Text("The streaming interface will open.\nUse the Chat and Monitor buttons\nto open floating windows.")
                    .foregroundColor(.gray)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            .padding(.top, 60)
        }
        .background(Color.black.edgesIgnoringSafeArea(.all))
    }

    func saveSettings() {
        UserDefaults.standard.set(serverURL, forKey: "serverURL")
        UserDefaults.standard.set(myUsername, forKey: "myUsername")
        UserDefaults.standard.set(monitorUsername, forKey: "monitorUsername")
    }

    func loadSettings() {
        serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? "https://mirror-stream-io.onrender.com"
        myUsername = UserDefaults.standard.string(forKey: "myUsername") ?? ""
        monitorUsername = UserDefaults.standard.string(forKey: "monitorUsername") ?? ""
    }
}

// Floating draggable window component
struct FloatingWindow<Content: View>: View {
    let title: String
    @Binding var offset: CGSize
    @Binding var size: CGSize
    let onClose: () -> Void
    let content: () -> Content

    @State private var dragOffset = CGSize.zero

    var body: some View {
        VStack(spacing: 0) {
            // Title bar
            HStack {
                Text(title)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
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
        }
        .background(Color.black)
        .cornerRadius(8)
        .shadow(radius: 10)
        .offset(x: offset.width + dragOffset.width, y: offset.height + dragOffset.height)
    }
}

#Preview {
    ContentView()
}
