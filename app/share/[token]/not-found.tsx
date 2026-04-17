export default function ShareNotFound() {
  return (
    <main className="paper-bg min-h-screen flex items-center justify-center p-6">
      <div className="card-paper max-w-md w-full p-8 text-center">
        <div className="eyebrow mb-3">رابط غير صالح</div>
        <h1 className="font-display text-3xl text-foreground mb-3">
          لم نجد هذه المشاركة
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          الرابط غير صحيح، أو تم إبطاله بواسطة صاحب المشروع.
        </p>
      </div>
    </main>
  )
}
