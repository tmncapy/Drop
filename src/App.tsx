import { 
  Play, 
  Settings, 
  User, 
  Monitor, 
  HelpCircle, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  Table 
} from 'lucide-react';

export default function App() {
  const openWindow = (url: string) => {
    window.open(url, '_blank');
  };

  const screens = [
    {
      title: "1. Bàn Điều Khiển (Tech Controller)",
      filename: "controller.html",
      icon: <Settings className="w-8 h-8 text-amber-500" />,
      desc: "Phòng máy dùng để nạp đề Excel, chốt chủ đề, gửi câu hỏi, hiển thị đáp án, chạy đồng hồ 60 giây và kích hoạt sập hố vật lý.",
      color: "border-amber-500/20 hover:border-amber-500/50 bg-amber-950/10",
      btnText: "Mở Bàn Điều Khiển",
      badge: "Máy Kỹ Thuật"
    },
    {
      title: "2. Màn Hình Host (MC Dashboard)",
      filename: "host.html",
      icon: <Play className="w-8 h-8 text-emerald-500" />,
      desc: "MC theo dõi câu hỏi đang chạy, danh sách đáp án, giải thích từ hệ thống, tin nhắn kỹ thuật và số lượng tiền cược của người chơi trên các cửa.",
      color: "border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-950/10",
      btnText: "Mở Màn Hình Host",
      badge: "MC / Người Dẫn"
    },
    {
      title: "3. Giao Diện Đặt Cược (Player)",
      filename: "player.html",
      icon: <User className="w-8 h-8 text-blue-500" />,
      desc: "Người chơi trực tiếp kéo thả các cọc tiền $A vào các cửa (hoặc nhấn để đặt nhanh), theo dõi thời gian và xem chủ đề/câu hỏi trực tuyến.",
      color: "border-blue-500/20 hover:border-blue-500/50 bg-blue-950/10",
      btnText: "Mở Giao Diện Đặt Cược",
      badge: "Người Chơi"
    },
    {
      title: "4. Màn Hình Máy Chiếu (Projector)",
      filename: "projector.html",
      icon: <Monitor className="w-8 h-8 text-purple-500" />,
      desc: "Màn hình lớn sân khấu hiển thị hiệu ứng chọn chủ đề, phóng to câu hỏi, hiện các ô đáp án và đồng hồ đếm ngược khổng lồ cho khán giả.",
      color: "border-purple-500/20 hover:border-purple-500/50 bg-purple-950/10",
      btnText: "Mở Màn Hình Máy Chiếu",
      badge: "Khán Giả / Studio"
    },
    {
      title: "5. Màn Hình Cửa Đáp Án (Answer Doors)",
      filename: "answer.html",
      icon: <AlertCircle className="w-8 h-8 text-rose-500" />,
      desc: "Giao diện mở/khép cánh cửa và hiển thị số tiền rơi, tương ứng với sập hố vật lý tại trường quay.",
      color: "border-rose-500/20 hover:border-rose-500/50 bg-rose-950/10",
      btnText: "Mở Màn Hình Đáp Án",
      badge: "Drop Doors"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0f12] text-slate-200 font-sans p-6 md:p-12 selection:bg-amber-500 selection:text-black">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-12 border-b border-slate-800 pb-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-xs font-semibold tracking-wider text-amber-500 uppercase">Hệ thống điều khiển Gameshow</span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-1 tracking-tight">Đừng Để Tiền Rơi</h1>
              <p className="text-slate-400 mt-2 max-w-xl text-sm leading-relaxed">
                Hệ thống điều khiển đa màn hình thời gian thực kết nối đa thiết bị trực tuyến (WebSockets MQTT & BroadcastChannel).
                Hỗ trợ chạy trên mạng LAN/GitHub Pages/Tất cả thiết bị di động & máy tính khác nhau.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-lg text-xs text-slate-400 text-left">
              <span className="font-bold text-amber-500">Trạng thái hệ thống:</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Liên kết mạng đa thiết bị (Online / Cross-Device Ready)</span>
              </div>
            </div>
          </div>
        </header>

        {/* Bugfixes Highlight */}
        <section className="mb-10 bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 md:p-6">
          <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5" /> Đã Sửa Các Lỗi Theo Yêu Cầu:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="mt-1 bg-emerald-500/10 p-0.5 rounded text-emerald-500 font-bold text-xs">VÀO</div>
                <p className="text-slate-300">
                  <strong className="text-white">Lỗi Host.html không chạy khi bấm 60s:</strong> Đã khắc phục triệt để bằng việc định nghĩa biến <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-400">timerAudio</code> tại đầu file và xử lý các hàm âm thanh chạy không đồng bộ (bọc trong <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400">.play().catch(...)</code>) tránh bị trình duyệt chặn.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1 bg-emerald-500/10 p-0.5 rounded text-emerald-500 font-bold text-xs">VÀO</div>
                <p className="text-slate-300">
                  <strong className="text-white">Hiển thị Đáp án, Câu hỏi:</strong> Đồng bộ hoàn toàn việc truyền dữ liệu câu hỏi và đáp án trên <strong className="text-amber-500">TẤT CẢ các màn hình</strong> (Host, Player, Projector) ngay khi bấm từ Máy Tech. (Trừ màn hình <code className="text-slate-400">answer.html</code> chỉ hiện đáp án tại cửa theo yêu cầu).
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="mt-1 bg-emerald-500/10 p-0.5 rounded text-emerald-500 font-bold text-xs">VÀO</div>
                <p className="text-slate-300">
                  <strong className="text-white">Nhập toạ độ file Excel đề bị sai:</strong> Nâng cấp hàm <code className="bg-slate-900 px-1 text-amber-400">parseExcelQuestions</code> thông minh, tự động nhận diện cả <strong className="text-amber-500">2 dạng bố cục Excel</strong>: Dạng 1 câu/dòng (Dual-row) và Dạng 1 vòng 2 đề/dòng (Single-row).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1 bg-emerald-500/10 p-0.5 rounded text-emerald-500 font-bold text-xs">VÀO</div>
                <p className="text-slate-300">
                  <strong className="text-white">Lỗi đồng bộ Chủ đề &amp; Vòng:</strong> Sửa lỗi đồng bộ chủ đề do sai khóa dữ liệu (<code className="text-rose-400">data.ta</code> thành <code className="text-emerald-400">data.topicA</code>). Tự động cập nhật vòng chơi trên mọi thiết bị khi tải câu hỏi cụ thể từ danh sách Excel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">Mở Các Màn Hình Chức Năng</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {screens.map((screen, idx) => (
              <div 
                key={idx} 
                className={`border rounded-xl p-5 flex flex-col justify-between transition-all duration-300 ${screen.color} hover:translate-y-[-2px]`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    {screen.icon}
                    <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {screen.badge}
                    </span>
                  </div>
                  <h3 className="text-md font-bold text-white mb-2">{screen.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">{screen.desc}</p>
                </div>
                
                <button
                  onClick={() => openWindow(screen.filename)}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-amber-500" /> {screen.btnText}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Operational Guide */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-md font-bold text-white flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-amber-500" /> Quy trình vận hành Gameshow tại trường quay:
            </h2>
            <div className="space-y-4 text-xs md:text-sm text-slate-300">
              <div className="flex gap-3">
                <span className="bg-amber-500 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                <p>
                  Mở các màn hình cần dùng ra các tab riêng biệt bằng các nút phía trên. Bạn có thể kéo chúng sang các màn hình phụ khác nhau (MC nhìn màn hình Host, máy kỹ thuật giữ màn hình Tech, người chơi giữ màn hình Player, máy chiếu kết nối Projector).
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                <p>
                  Tại <strong className="text-white">Bàn Điều Khiển</strong>, bấm <strong className="text-amber-500">Tải Câu Hỏi Từ Excel</strong> và chọn file đề thi có cấu trúc của bạn. Hệ thống sẽ tự động phân tích và đưa danh sách các vòng chơi vào ô chọn.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">3</span>
                <p>
                  Chọn câu hỏi cụ thể, bấm <strong className="text-amber-500">Hiện 2 Chủ Đề</strong> để người chơi lựa chọn. Sau đó bấm <strong className="text-amber-500">Chốt Chủ Đề A/B</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">4</span>
                <p>
                  Bấm <strong className="text-amber-500">Hiện Câu Hỏi Lên Màn Hình</strong> và lần lượt hiện các phương án tương ứng bằng các nút <strong className="text-amber-500">Hiện Đáp Án 1-4</strong>. Đồng bộ câu hỏi và đáp án sẽ được cập nhật đồng loạt ngay lập tức.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="bg-amber-500 text-black font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">5</span>
                <p>
                  Bấm <strong className="text-amber-500">Bắt Đầu Đếm (60s)</strong> để người chơi kéo thả đặt cược tiền. Khi hết giờ, tiến hành chốt kết quả và sập hố các cửa sai bằng các nút <strong className="text-amber-500">SẬP HỐ LỖI</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-md font-bold text-white flex items-center gap-2 mb-4">
              <Table className="w-5 h-5 text-amber-500" /> Cấu Trúc File Excel Hỗ Trợ:
            </h2>
            <div className="space-y-4 text-xs text-slate-400">
              <p>Hệ thống tự động phát hiện và tương thích tuyệt đối với các kiểu cấu trúc đề sau:</p>
              
              <div className="border-l-2 border-amber-500/40 pl-3">
                <strong className="text-white block mb-1">Kiểu 1: Mỗi dòng là một vòng chơi (Khuyên dùng)</strong>
                <span>Hàng ngang bao gồm: Vòng, Chủ đề A, Câu hỏi A, Đ.án A1-4, Chủ đề B, Câu hỏi B, Đ.án B1-4.</span>
              </div>

              <div className="border-l-2 border-slate-700 pl-3">
                <strong className="text-white block mb-1">Kiểu 2: Hai dòng liên tiếp chung 1 vòng</strong>
                <span>Dòng 1 cho Chủ đề A, dòng 2 cho Chủ đề B. Mỗi dòng bao gồm: Vòng, Tên chủ đề, Câu hỏi, Đ.án 1-4.</span>
              </div>
              
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Âm thanh đếm ngược SFX được đặt tại đường dẫn <code className="text-slate-300">SFX/drop_timer.mp3</code> để tự động kích hoạt.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-600 border-t border-slate-900 pt-8 mb-4">
          <p>Hệ Thống Trực Quan Đồng Bộ Đa Điểm Gameshow "Đừng Để Tiền Rơi" © 2026. Tối ưu hóa cho tất cả trình duyệt hiện đại.</p>
        </footer>

      </div>
    </div>
  );
}
