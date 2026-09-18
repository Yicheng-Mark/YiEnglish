// 管理后台：用户管理（列表/续期/设备上限）+ 激活码管理（生成/停用/发放备注）+ 操作审计。
// 仅管理员可见入口（PersonalCenter 按 user.isAdmin 显示）；接口侧由 requireAdmin 拦截，
// 非管理员直链访问只会得到 404。样式与数据流对齐 Devices.jsx（卡片列表 + toast + 行内操作）。
import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Users,
  Ticket,
  ScrollText,
  ShieldCheck,
  Loader2,
  Plus,
  Ban,
  RotateCcw,
  Copy,
  Check,
  X,
} from 'lucide-react'
import {
  fetchAdminUsers,
  renewSubscription,
  setMaxDevices,
  fetchAdminCodes,
  createCodes,
  updateCode,
  fetchAdminAudit,
  fetchTotpStatus,
  setupTotp,
  enableTotp,
  disableTotp,
} from '../lib/api-admin'
import { copyText } from '../utils/clipboard'

const PAGE_SIZE = 20

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 到期徽章：永久 / 已到期 / 7 天内 / 正常
function ExpiryBadge({ sub }) {
  if (sub === null) return <span className="badge-ok">永久</span>
  const days = Math.ceil((new Date(sub).getTime() - Date.now()) / 86400000)
  if (days < 0) return <span className="badge-danger">已到期 {-days} 天</span>
  if (days <= 7) return <span className="badge-warn">{days} 天后到期</span>
  return <span className="badge-muted">{fmtDate(sub)} 到期</span>
}

const TIER_LABEL = { 0: '永久', 720: '月卡', 2160: '季卡', 8760: '年卡' }
const ACTION_LABEL = {
  renew_subscription: '续期',
  set_max_devices: '设备上限',
  create_codes: '生成码',
  update_code: '改码',
  totp_enable: '开启两步验证',
  totp_disable: '关闭两步验证',
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-content dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-content-tertiary" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Pager({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="btn-ghost text-sm disabled:opacity-40"
      >
        上一页
      </button>
      <span className="text-sm text-content-tertiary">
        {page} / {pages}（共 {total} 条）
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="btn-ghost text-sm disabled:opacity-40"
      >
        下一页
      </button>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-gray-100 dark:bg-white/[0.06] text-content-tertiary hover:text-content dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

// ============ 用户 Tab ============
function UsersTab() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [scope, setScope] = useState('all')
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [renewing, setRenewing] = useState(null) // 用户行
  const [renewDays, setRenewDays] = useState(30)
  const [deviceUser, setDeviceUser] = useState(null) // 用户行
  const [deviceValue, setDeviceValue] = useState('') // ''=全局默认, '0'=不限, 数字
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminUsers({ scope, filter, search, page, pageSize: PAGE_SIZE })
      setUsers(data.users)
      setTotal(data.total)
    } catch (err) {
      toast('加载失败', { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [scope, filter, search, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleRenew() {
    if (!renewing) return
    setBusy(true)
    try {
      await renewSubscription(renewing.id, { days: renewDays })
      toast(`已为 ${renewing.username} 续期 ${renewDays} 天`)
      setRenewing(null)
      load()
    } catch (err) {
      toast('续期失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handlePermanent() {
    if (!renewing) return
    setBusy(true)
    try {
      await renewSubscription(renewing.id, { permanent: true })
      toast(`已将 ${renewing.username} 转为永久`)
      setRenewing(null)
      load()
    } catch (err) {
      toast('操作失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleSetDevices() {
    if (!deviceUser) return
    setBusy(true)
    try {
      const value = deviceValue === '' ? null : parseInt(deviceValue, 10)
      await setMaxDevices(deviceUser.id, value)
      toast(`已更新 ${deviceUser.username} 的设备上限`)
      setDeviceUser(null)
      load()
    } catch (err) {
      toast('操作失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chip
          active={scope === 'all'}
          onClick={() => {
            setScope('all')
            setPage(1)
          }}
        >
          全部
        </Chip>
        <Chip
          active={scope === 'real'}
          onClick={() => {
            setScope('real')
            setPage(1)
          }}
        >
          正式
        </Chip>
        <Chip
          active={scope === 'guest'}
          onClick={() => {
            setScope('guest')
            setPage(1)
          }}
        >
          访客
        </Chip>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <Chip
          active={filter === ''}
          onClick={() => {
            setFilter('')
            setPage(1)
          }}
        >
          不限到期
        </Chip>
        <Chip
          active={filter === 'expiring'}
          onClick={() => {
            setFilter('expiring')
            setPage(1)
          }}
        >
          7 天内到期
        </Chip>
        <Chip
          active={filter === 'expired'}
          onClick={() => {
            setFilter('expired')
            setPage(1)
          }}
        >
          已到期
        </Chip>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
            setPage(1)
          }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索用户名/昵称"
            className="field text-sm w-40"
          />
          <button type="submit" className="btn-ghost text-sm">
            搜索
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-content-tertiary" />
        </div>
      ) : users.length === 0 ? (
        <div className="card py-10 text-center text-content-tertiary">没有匹配的用户</div>
      ) : (
        users.map((u) => (
          <div key={u.id} className="card p-4 mb-2 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-content dark:text-gray-100">{u.username}</span>
                {u.nickname !== u.username && (
                  <span className="text-sm text-content-tertiary">{u.nickname}</span>
                )}
                {u.isAdmin && <span className="badge-warn">管理员</span>}
                {u.isAdmin && u.hasTotp && <span className="badge-ok">2FA</span>}
                {u.isGuest && <span className="badge-muted">访客</span>}
                {!u.isGuest && <ExpiryBadge sub={u.subscriptionExpiresAt} />}
              </div>
              <div className="text-xs text-content-tertiary mt-1">
                注册 {fmtDate(u.createdAt)} · 最近活跃 {fmtDate(u.lastActiveAt)} · 设备{' '}
                {u.deviceCount} 台
                {u.maxDevices === null
                  ? '（全局默认上限）'
                  : u.maxDevices === 0
                    ? '（不限）'
                    : `（上限 ${u.maxDevices}）`}
              </div>
            </div>
            {!u.isGuest && !u.isAdmin && (
              <div className="flex items-center gap-2">
                {/* 永久账号（subscriptionExpiresAt=null）无到期可续，接口侧同样拒绝 days 续期防降级 */}
                {u.subscriptionExpiresAt !== null && (
                  <button
                    className="btn-ghost text-sm"
                    onClick={() => {
                      setRenewing(u)
                      setRenewDays(30)
                    }}
                  >
                    续期
                  </button>
                )}
                <button
                  className="btn-ghost text-sm"
                  onClick={() => {
                    setDeviceUser(u)
                    setDeviceValue(u.maxDevices === null ? '' : String(u.maxDevices))
                  }}
                >
                  设备上限
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      <Modal
        open={!!renewing}
        onClose={() => setRenewing(null)}
        title={`续期 · ${renewing?.username || ''}`}
      >
        <div className="flex items-center gap-2 mb-4">
          {[30, 90, 365].map((d) => (
            <Chip key={d} active={renewDays === d} onClick={() => setRenewDays(d)}>
              {d} 天
            </Chip>
          ))}
          <input
            type="number"
            min="1"
            max="3650"
            value={renewDays}
            onChange={(e) => setRenewDays(parseInt(e.target.value, 10) || 1)}
            className="field text-sm w-24"
          />
        </div>
        <p className="text-sm text-content-tertiary mb-5">
          从当前到期时间与现在中较晚者起算（未到期续期不吃亏）；用户下次自动刷新后生效。
        </p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={handleRenew}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `续期 ${renewDays} 天`}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={handlePermanent}>
            转为永久
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deviceUser}
        onClose={() => setDeviceUser(null)}
        title={`设备上限 · ${deviceUser?.username || ''}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Chip active={deviceValue === ''} onClick={() => setDeviceValue('')}>
            全局默认
          </Chip>
          <Chip active={deviceValue === '0'} onClick={() => setDeviceValue('0')}>
            不限
          </Chip>
          <input
            type="number"
            min="1"
            max="10"
            placeholder="自定义"
            value={deviceValue === '' || deviceValue === '0' ? '' : deviceValue}
            onChange={(e) => setDeviceValue(e.target.value)}
            className="field text-sm w-24"
          />
        </div>
        <p className="text-sm text-content-tertiary mb-5">
          调低不会立刻踢人，被驱逐设备下次刷新时收到登出。
        </p>
        <button className="btn-primary w-full" disabled={busy} onClick={handleSetDevices}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
        </button>
      </Modal>
    </div>
  )
}

// ============ 激活码 Tab ============
function CodesTab() {
  const [codes, setCodes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [tier, setTier] = useState('') // ''=全部档位
  const [loading, setLoading] = useState(true)
  // maxUses 固定 1（一码一人），不在表单暴露——仅站长本人用后台，无人需要多用途码
  const [form, setForm] = useState({ trialHours: 720, count: 10, description: '' })
  const [generated, setGenerated] = useState(null) // { codes: [...] }
  const [noteEditing, setNoteEditing] = useState(null) // 码行
  const [noteInput, setNoteInput] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminCodes({ status, tier, page, pageSize: PAGE_SIZE })
      setCodes(data.codes)
      setTotal(data.total)
    } catch (err) {
      toast('加载失败', { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [status, tier, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    setBusy(true)
    try {
      const data = await createCodes({ ...form, maxUses: 1 })
      setGenerated(data)
      toast(`已生成 ${data.codes.length} 个${TIER_LABEL[form.trialHours]}码`)
      load()
    } catch (err) {
      toast('生成失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive(code) {
    try {
      await updateCode(code.id, { isActive: !code.isActive })
      toast(code.isActive ? `已停用 ${code.code}` : `已启用 ${code.code}`)
      load()
    } catch (err) {
      toast('操作失败', { description: err.message })
    }
  }

  async function handleSaveNote() {
    if (!noteEditing) return
    setBusy(true)
    try {
      await updateCode(noteEditing.id, { issuedNote: noteInput })
      toast('发放备注已保存')
      setNoteEditing(null)
      load()
    } catch (err) {
      toast('保存失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-primary" />
          <span className="font-medium text-content dark:text-gray-100">生成激活码</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={form.trialHours}
            onChange={(e) => setForm({ ...form, trialHours: parseInt(e.target.value, 10) })}
            className="field text-sm w-28"
          >
            <option value={0}>永久</option>
            <option value={720}>月卡</option>
            <option value={2160}>季卡</option>
            <option value={8760}>年卡</option>
          </select>
          <input
            type="number"
            min="1"
            max="200"
            value={form.count}
            onChange={(e) => setForm({ ...form, count: parseInt(e.target.value, 10) || 1 })}
            className="field text-sm w-24"
            placeholder="数量"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="field text-sm flex-1 min-w-40"
            placeholder="批次备注（如 202609 批次）"
          />
          <button className="btn-primary text-sm" disabled={busy} onClick={handleCreate}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '生成'}
          </button>
        </div>
        {generated && (
          <div className="mt-3 p-3 rounded-xl bg-gray-100/60 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-content-tertiary">
                新生成的注册码（{generated.codes.length} 个）
              </span>
              <button
                className="btn-ghost text-xs flex items-center gap-1"
                onClick={() => copyText(generated.codes.join('\n')).then(() => toast('已全部复制'))}
              >
                <Copy className="w-3.5 h-3.5" /> 复制全部
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto font-mono text-xs leading-6 text-content dark:text-gray-200">
              {generated.codes.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <button
                    className="text-primary hover:underline"
                    onClick={() =>
                      copyText(`https://www.lingoforge.fun/activate/${c}`).then(() =>
                        toast('注册链接已复制')
                      )
                    }
                  >
                    {c}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-content-tertiary mt-2">点击码复制完整注册链接</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chip
          active={status === ''}
          onClick={() => {
            setStatus('')
            setPage(1)
          }}
        >
          全部状态
        </Chip>
        <Chip
          active={status === 'available'}
          onClick={() => {
            setStatus('available')
            setPage(1)
          }}
        >
          可用
        </Chip>
        <Chip
          active={status === 'exhausted'}
          onClick={() => {
            setStatus('exhausted')
            setPage(1)
          }}
        >
          已用完
        </Chip>
        <Chip
          active={status === 'disabled'}
          onClick={() => {
            setStatus('disabled')
            setPage(1)
          }}
        >
          已停用
        </Chip>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <Chip
          active={tier === ''}
          onClick={() => {
            setTier('')
            setPage(1)
          }}
        >
          全部档位
        </Chip>
        {[0, 720, 2160, 8760].map((h) => (
          <Chip
            key={h}
            active={tier === h}
            onClick={() => {
              setTier(h)
              setPage(1)
            }}
          >
            {TIER_LABEL[h]}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-content-tertiary" />
        </div>
      ) : codes.length === 0 ? (
        <div className="card py-10 text-center text-content-tertiary">没有匹配的码</div>
      ) : (
        codes.map((c) => (
          <div key={c.id} className="card p-4 mb-2 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-content dark:text-gray-100">{c.code}</span>
                <span className="badge-muted">
                  {TIER_LABEL[c.trialHours] || `${c.trialHours}h`}
                </span>
                {c.type === 'trial' && <span className="badge-warn">体验码</span>}
                {!c.isActive && <span className="badge-danger">已停用</span>}
                {c.maxUses === 0 ? (
                  <span className="badge-muted">不限次</span>
                ) : (
                  <span className={c.currentUses >= c.maxUses ? 'badge-danger' : 'badge-ok'}>
                    {c.currentUses}/{c.maxUses}
                  </span>
                )}
                <span className="badge-muted">注册 {c.registeredUsers} 人</span>
              </div>
              <div className="text-xs text-content-tertiary mt-1">
                {c.description && <>「{c.description}」· </>}
                创建 {fmtDate(c.createdAt)}
                {c.issuedNote ? ` · 发放：${c.issuedNote}` : ' · 未标注发放'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  setNoteEditing(c)
                  setNoteInput(c.issuedNote || '')
                }}
              >
                备注
              </button>
              {c.isActive ? (
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={() => handleToggleActive(c)}
                >
                  <Ban className="w-3.5 h-3.5" /> 停用
                </button>
              ) : (
                <button
                  className="btn-ghost text-xs flex items-center gap-1"
                  onClick={() => handleToggleActive(c)}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 启用
                </button>
              )}
            </div>
          </div>
        ))
      )}

      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      <Modal
        open={!!noteEditing}
        onClose={() => setNoteEditing(null)}
        title={`发放备注 · ${noteEditing?.code || ''}`}
      >
        <input
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="发给谁 / 渠道（如：微信 张三）"
          className="field w-full mb-4"
        />
        <button className="btn-primary w-full" disabled={busy} onClick={handleSaveNote}>
          保存
        </button>
      </Modal>
    </div>
  )
}

// ============ 审计 Tab ============
function AuditTab() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminAudit({ page, pageSize: PAGE_SIZE })
      setLogs(data.logs)
      setTotal(data.total)
    } catch (err) {
      toast('加载失败', { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-content-tertiary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card py-10 text-center text-content-tertiary">暂无操作记录</div>
      ) : (
        logs.map((l) => (
          <div key={l.id} className="card p-4 mb-2 flex flex-wrap items-center gap-3">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-content dark:text-gray-100">
                <span className="font-medium">{l.adminUsername}</span>
                <span className="mx-2 text-content-tertiary">·</span>
                {ACTION_LABEL[l.action] || l.action}
                {l.targetId !== null && (
                  <span className="text-content-tertiary">
                    （{l.targetType === 'user' ? '用户' : '码'} #{l.targetId}）
                  </span>
                )}
              </div>
              <div className="text-xs text-content-tertiary mt-1">
                {fmtDateTime(l.createdAt)} · IP {l.ip || '—'}
                {l.detail ? ` · ${l.detail}` : ''}
              </div>
            </div>
          </div>
        ))
      )}
      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}

// ============ 安全 Tab（管理员两步验证） ============
function SecurityTab() {
  const [enabled, setEnabled] = useState(null) // null=加载中
  // 开启流程：setup 拿到密钥 → 用户在验证器 App 添加 → 输入当前验证码 enable
  const [setup, setSetup] = useState(null) // { secret, otpauthUrl }
  const [code, setCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetchTotpStatus()
      setEnabled(!!data.enabled)
    } catch (err) {
      toast('加载失败', { description: err.message })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSetup() {
    setBusy(true)
    try {
      const data = await setupTotp()
      setSetup(data)
      setCode('')
    } catch (err) {
      toast('生成密钥失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleEnable() {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error('请输入 6 位动态验证码')
      return
    }
    setBusy(true)
    try {
      await enableTotp(setup.secret, code.trim())
      toast.success('两步验证已开启')
      setSetup(null)
      setCode('')
      load()
    } catch (err) {
      toast('开启失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    if (!/^\d{6}$/.test(disableCode.trim())) {
      toast.error('请输入 6 位动态验证码')
      return
    }
    setBusy(true)
    try {
      await disableTotp(disableCode.trim())
      toast.success('两步验证已关闭')
      setDisableCode('')
      load()
    } catch (err) {
      toast('关闭失败', { description: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (enabled === null) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-content-tertiary" />
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-content dark:text-gray-100">登录两步验证（TOTP）</span>
          <span className={enabled ? 'badge-ok' : 'badge-muted'}>
            {enabled ? '已开启' : '未开启'}
          </span>
        </div>
        <p className="text-sm text-content-tertiary mb-4">
          开启后登录与找回密码在密码之外还需验证器 App 生成的 6 位动态验证码，
          防止密码泄露后管理端被接管。停用同样需要出示当前验证码。
        </p>

        {!enabled && !setup && (
          <button className="btn-primary" disabled={busy} onClick={handleSetup}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '开启两步验证'}
          </button>
        )}

        {!enabled && setup && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-gray-100/60 dark:bg-white/[0.04]">
              <p className="text-sm text-content-tertiary mb-2">
                1. 在验证器 App（Google Authenticator / Microsoft Authenticator / 1Password 等）
                中「手动输入密钥」添加以下账号：
              </p>
              <div className="flex items-center gap-2 mb-3">
                <code className="font-mono text-sm tracking-wider break-all text-content dark:text-gray-200">
                  {setup.secret}
                </code>
                <button
                  className="btn-ghost text-xs flex items-center gap-1 flex-shrink-0"
                  onClick={() => copyText(setup.secret).then(() => toast('密钥已复制'))}
                >
                  <Copy className="w-3.5 h-3.5" /> 复制
                </button>
              </div>
              <p className="text-xs text-content-tertiary">
                手机端也可直接点击
                <a href={setup.otpauthUrl} className="text-primary hover:underline mx-1">
                  otpauth 链接
                </a>
                唤起验证器添加。
              </p>
            </div>
            <div>
              <p className="text-sm text-content-tertiary mb-2">
                2. 输入验证器当前显示的 6 位验证码完成开启：
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6 位验证码"
                  className="field text-sm w-32 tracking-[0.3em]"
                />
                <button className="btn-primary text-sm" disabled={busy} onClick={handleEnable}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认开启'}
                </button>
                <button
                  className="btn-ghost text-sm"
                  disabled={busy}
                  onClick={() => setSetup(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {enabled && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="当前验证码"
              className="field text-sm w-32 tracking-[0.3em]"
            />
            <button className="btn-ghost text-sm" disabled={busy} onClick={handleDisable}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '关闭两步验证'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-content-tertiary">
        验证器丢失时无法登录：需在数据库执行 UPDATE users SET totp_secret = NULL WHERE username =
        '你的用户名' 后重新开启。
      </p>
    </div>
  )
}

// ============ 页面 ============
export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')

  const tabs = [
    { key: 'users', label: '用户', Icon: Users },
    { key: 'codes', label: '激活码', Icon: Ticket },
    { key: 'audit', label: '审计', Icon: ScrollText },
    { key: 'security', label: '安全', Icon: ShieldCheck },
  ]

  return (
    <div className="min-h-[calc(100vh-3rem-3.5rem)] md:min-h-[calc(100vh-4rem-3.5rem)] max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-page-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-content-tertiary hover:text-content dark:hover:text-gray-200 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>
      <h1 className="text-2xl font-bold text-content dark:text-gray-100 mb-6">管理后台</h1>

      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-gray-100/60 dark:bg-white/[0.04] w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface text-content dark:text-gray-100 shadow-sm'
                : 'text-content-tertiary hover:text-content dark:hover:text-gray-200'
            }`}
          >
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  )
}
