import styles from './VoiceIndicators.module.css'

export function RecordingIndicator() {
  return (
    <div className={styles.recordingBar}>
      <span className={styles.bar} style={{ animationDelay: '0ms' }} />
      <span className={styles.bar} style={{ animationDelay: '150ms' }} />
      <span className={styles.bar} style={{ animationDelay: '300ms' }} />
      <span className={styles.bar} style={{ animationDelay: '150ms' }} />
      <span className={styles.bar} style={{ animationDelay: '0ms' }} />
    </div>
  )
}

export function PlaybackPulse() {
  return <span className={styles.playbackPulse} />
}
