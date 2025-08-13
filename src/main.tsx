import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'

// 只在生产环境中禁用右键菜单和开发者工具
if (import.meta.env.PROD) {
  // 添加生产环境样式
  const style = document.createElement('style')
  style.textContent = `
    * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-user-drag: none;
      -khtml-user-drag: none;
      -moz-user-drag: none;
      -o-user-drag: none;
      user-drag: none;
    }
    
    input, textarea, [contenteditable] {
      -webkit-user-select: text !important;
      -khtml-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `
  document.head.appendChild(style)

  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  // 禁用选择和拖拽
  document.addEventListener('selectstart', (e) => {
    if (!(e.target as HTMLElement).matches('input, textarea, [contenteditable]')) {
      e.preventDefault()
    }
  })

  document.addEventListener('dragstart', (e) => {
    e.preventDefault()
  })

  // 禁用开发者工具快捷键
  document.addEventListener('keydown', (e) => {
    // 禁用 F12
    if (e.key === 'F12') {
      e.preventDefault()
    }
    // 禁用 Ctrl+Shift+I (Windows/Linux) 和 Cmd+Option+I (Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault()
    }
    // 禁用 Ctrl+Shift+J (Windows/Linux) 和 Cmd+Option+J (Mac)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
      e.preventDefault()
    }
    // 禁用 Ctrl+U (Windows/Linux) 和 Cmd+U (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault()
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)