import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { FiPlus, FiSearch, FiTerminal, FiEdit2, FiTrash2, FiServer, FiUser, FiLock, FiX, FiCheck, FiCopy, FiShield, FiKey, FiUpload, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';

const ConstellationParticles = () => {
    const canvasRef = useRef(null);
    const mouse = useRef({ x: null, y: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init();
        };

        window.addEventListener('resize', resize);

        window.addEventListener('mousemove', (e) => {
            mouse.current.x = e.clientX;
            mouse.current.y = e.clientY;
        });

        const colors = ['#ff0055', '#33ff55', '#0099ff', '#ffff00', '#cc00ff', '#00ffff', '#ff9900', '#ff00aa'];
        let textParticles = [];

        class Particle {
            constructor(x, y, isText = false) {
                this.isText = isText;
                this.baseX = x;
                this.baseY = y;
                this.x = x || Math.random() * canvas.width;
                this.y = y || Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * (isText ? 0.3 : 1.2);
                this.vy = (Math.random() - 0.5) * (isText ? 0.3 : 1.2);
                this.radius = isText ? Math.random() * 1.5 + 1 : Math.random() * 2 + 1;
                this.color = isText ? '#ffffff' : colors[Math.floor(Math.random() * colors.length)];
                this.density = (Math.random() * 30) + 1;
            }

            update() {
                if (this.isText) {
                    // Pull back to base position
                    const dx = this.baseX - this.x;
                    const dy = this.baseY - this.y;
                    this.x += dx * 0.05;
                    this.y += dy * 0.05;
                }

                this.x += this.vx;
                this.y += this.vy;

                if (!this.isText) {
                    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
                }

                if (mouse.current.x) {
                    const dx = mouse.current.x - this.x;
                    const dy = mouse.current.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        const force = (120 - dist) / 120;
                        this.x -= dx * force * 0.2;
                        this.y -= dy * force * 0.2;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }

        const init = () => {
            textParticles = [];

            // Create Text Particles
            const hiddenCanvas = document.createElement('canvas');
            const hCtx = hiddenCanvas.getContext('2d');
            hiddenCanvas.width = canvas.width;
            hiddenCanvas.height = canvas.height;
            
            hCtx.fillStyle = 'white';
            const isSmallScreen = canvas.width < 600;
            const fontSize = isSmallScreen ? Math.min(canvas.width / 10, 40) : Math.min(canvas.width / 15, 52);
            hCtx.font = `600 ${fontSize}px "Outfit", "Inter", "Segoe UI", sans-serif`;
            hCtx.textAlign = 'center';
            hCtx.textBaseline = 'middle';
            
            const bottomPadding = 80;
            if (isSmallScreen) {
                // Multi-line for mobile
                hCtx.fillText('DEVELOPER BY', canvas.width / 2, canvas.height - bottomPadding - fontSize * 1.2);
                hCtx.fillText('MEHAN AHMED', canvas.width / 2, canvas.height - bottomPadding);
            } else {
                hCtx.fillText('DEVELOPER BY MEHAN AHMED', canvas.width / 2, canvas.height - bottomPadding);
            }

            const imageData = hCtx.getImageData(0, 0, canvas.width, canvas.height).data;
            const skip = isSmallScreen ? 3 : 4; // Higher density on mobile for readability
            for (let y = 0; y < canvas.height; y += skip) {
                for (let x = 0; x < canvas.width; x += skip) {
                    const index = (y * canvas.width + x) * 4;
                    if (imageData[index + 3] > 128) {
                        const p = new Particle(x, y, true);
                        p.vx = 0;
                        p.vy = 0;
                        textParticles.push(p);
                    }
                }
            }
        };

        let lastTime = 0;
        const animate = (time) => {
            const deltaTime = (time - lastTime) / 16.67 || 1;
            lastTime = time;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const allParticles = textParticles;

            for (let i = 0; i < allParticles.length; i++) {
                const p1 = allParticles[i];
                
                // --- Update Logic ---
                if (p1.isText) {
                    const dx = p1.baseX - p1.x;
                    const dy = p1.baseY - p1.y;
                    p1.x += dx * 0.08 * deltaTime; // Smoother spring
                    p1.y += dy * 0.08 * deltaTime;
                }

                p1.x += p1.vx * 0.5 * deltaTime; // Slower, smoother drift
                p1.y += p1.vy * 0.5 * deltaTime;

                if (!p1.isText) {
                    if (p1.x < 0 || p1.x > canvas.width) p1.vx *= -1;
                    if (p1.y < 0 || p1.y > canvas.height) p1.vy *= -1;
                }

                if (mouse.current.x) {
                    const dx = mouse.current.x - p1.x;
                    const dy = mouse.current.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        const force = (120 - dist) / 120;
                        p1.x -= dx * force * 0.15 * deltaTime;
                        p1.y -= dy * force * 0.15 * deltaTime;
                    }
                }

                // --- Draw Particle ---
                p1.draw();

                // --- Connection Logic (Optimized for smoothness) ---
                for (let j = i + 1; j < allParticles.length; j++) {
                    const p2 = allParticles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    let distLimit = 18;
                    const distLimitSq = distLimit * distLimit;

                    if (distSq < distLimitSq) {
                        const dist = Math.sqrt(distSq);
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        const alpha = (1 - dist / distLimit) * 0.8;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        init();
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.9 }} />;
};

const App = () => {
    const [credentials, setCredentials] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [currentCredential, setCurrentCredential] = useState(null);
    const [isLocked, setIsLocked] = useState(true);
    const [masterPasswordInfo, setMasterPasswordInfo] = useState({ hasPassword: false, input: '' });
    const [toasts, setToasts] = useState([]);
    const [statuses, setStatuses] = useState({});

    const checkConnectionStatus = async (cred) => {
        setStatuses(prev => ({ ...prev, [cred.id]: 'checking' }));
        try {
            const res = await window.electron.checkConnection(cred.host, cred.port);
            setStatuses(prev => ({ ...prev, [cred.id]: res.status }));
        } catch (e) {
            setStatuses(prev => ({ ...prev, [cred.id]: 'offline' }));
        }
    };

    const checkAllStatuses = (listToCheck) => {
        const list = listToCheck || credentials;
        list.forEach(cred => {
            checkConnectionStatus(cred);
        });
    };

    // Load initial state
    useEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        const data = await window.electron.getCredentials();
        if (data.error) {
            addToast('Error loading credentials', 'error');
        } else {
            const list = Array.isArray(data) ? data : [];
            setCredentials(list);
            list.forEach(cred => {
                checkConnectionStatus(cred);
            });
        }
    };

    // Removed master password handlers

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newCred = {
            id: currentCredential ? currentCredential.id : uuidv4(),
            label: formData.get('label'),
            host: formData.get('host'),
            username: formData.get('username'),
            port: formData.get('port') || '22',
            password: formData.get('password') || '',
            remotePath: formData.get('remotePath') || '',
            command: formData.get('command') || '',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(s => s.trim()) : [],
        };

        // Removed duplicate check


        const result = await window.electron.saveCredential(newCred);
        if (result.error) {
            addToast(result.error, 'error');
        } else {
            setCredentials(result.list || result);
            setIsModalOpen(false);
            addToast(currentCredential ? 'Updated credential' : 'Added credential', 'success');
            loadCredentials(); // Refresh to be sure
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this credential?')) {
            await window.electron.deleteCredential(id);
            loadCredentials();
            addToast('Deleted credential', 'info');
        }
    };

    const handleLaunch = async (cred) => {
        addToast(`Launching ${cred.host}...`, 'info');
        await window.electron.launchSsh(cred);
    };

    const handleCopyPassword = (e, pwd) => {
        e.stopPropagation();
        if (!pwd) {
            addToast('No password stored', 'error');
            return;
        }
        navigator.clipboard.writeText(pwd);
        addToast('Password copied to clipboard', 'success');
    };

    const handleImport = async () => {
        addToast('Selecting backup file...', 'info');
        const res = await window.electron.importCredentials();
        if (res.success) {
            setCredentials(res.list);
            res.list.forEach(cred => {
                checkConnectionStatus(cred);
            });
            if (res.importedCount > 0) {
                let msg = `Imported ${res.importedCount} new connection(s)`;
                if (res.skippedCount > 0) {
                    msg += ` (${res.skippedCount} duplicate(s) skipped)`;
                }
                addToast(msg, 'success');
            } else {
                addToast(`No new connections found (${res.skippedCount} duplicate(s) skipped)`, 'info');
            }
        } else if (res.reason !== 'canceled') {
            addToast(res.error || 'Import failed', 'error');
        }
    };

    const handleExport = async () => {
        addToast('Preparing backup file...', 'info');
        const res = await window.electron.exportCredentials();
        if (res.success) {
            addToast('Backup exported successfully', 'success');
        } else if (res.reason !== 'canceled') {
            addToast(res.error || 'Export failed', 'error');
        }
    };

    const filteredCredentials = credentials.filter(c =>
        (c.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.host || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Removed Lock Screen

    return (
        <div className="main-wrapper">
            <ConstellationParticles />
            <div className="container">

            <div className="dashboard-header">
                <div className="search-container">
                    <FiSearch style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 1, pointerEvents: 'none' }} />
                    <input
                        type="text"
                        className="search-bar"
                        placeholder="Search hosts, user, tags..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ padding: '12px', minWidth: '44px', borderRadius: '50%', justifyContent: 'center' }} title="Import Backup (.ssh)" onClick={handleImport}>
                        <FiUpload size={20} />
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '12px', minWidth: '44px', borderRadius: '50%', justifyContent: 'center' }} title="Export Backup (.ssh)" onClick={handleExport}>
                        <FiDownload size={20} />
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '12px', minWidth: '44px', borderRadius: '50%', justifyContent: 'center' }} title="Refresh All Statuses" onClick={() => checkAllStatuses()}>
                        <FiRefreshCw size={20} />
                    </button>
                    <button className="btn" style={{ padding: '12px', minWidth: '44px', borderRadius: '50%', justifyContent: 'center' }} title="Add Connection" onClick={() => { setCurrentCredential(null); setIsModalOpen(true); }}>
                        <FiPlus size={20} />
                    </button>
                </div>
            </div>

            <motion.div layout className="card-grid">
                <AnimatePresence>
                    {filteredCredentials.map(cred => (
                        <motion.div
                            key={cred.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                            className="card"
                            onClick={() => handleLaunch(cred)}
                        >
                            <div className="card-header">
                                <div className="card-title-wrapper">
                                    <span 
                                        className={`status-dot ${statuses[cred.id] || 'unchecked'}`} 
                                        title={`Status: ${statuses[cred.id] || 'unchecked'}`}
                                    />
                                    <div className="card-title" title={cred.label || cred.host}>
                                        {cred.label || cred.host}
                                    </div>
                                </div>
                                <div className="card-actions">
                                    <button 
                                        className={`btn-icon ${statuses[cred.id] === 'checking' ? 'refreshing' : ''}`} 
                                        title="Check Status" 
                                        onClick={(e) => { e.stopPropagation(); checkConnectionStatus(cred); }}
                                    >
                                        <FiRefreshCw />
                                    </button>
                                    <button className="btn-icon" title="Copy Password" onClick={(e) => handleCopyPassword(e, cred.password)}><FiCopy /></button>
                                    <button className="btn-icon" title="Edit" onClick={(e) => { e.stopPropagation(); setCurrentCredential(cred); setIsModalOpen(true); }}><FiEdit2 /></button>
                                    <button className="btn-icon" title="Delete" style={{ color: 'var(--danger)' }} onClick={(e) => handleDelete(e, cred.id)}><FiTrash2 /></button>
                                </div>
                            </div>
                            
                            <div className="card-subtitle">
                                <div className="info-item">
                                    <FiUser size={14} style={{ color: 'var(--accent)' }} />
                                    <span className="info-badge">{cred.username}</span>
                                </div>
                                <div className="info-item">
                                    <FiServer size={14} />
                                    <span>{cred.host}</span>
                                    {cred.port !== '22' && <span className="tag" style={{ marginLeft: 'auto' }}>Port: {cred.port}</span>}
                                </div>
                            </div>

                            {cred.tags && cred.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    {cred.tags.map(tag => (
                                        <span key={tag} className="tag">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {filteredCredentials.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <FiServer size={48} style={{ opacity: 0.2 }} />
                    <p>No credentials found</p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="modal"
                        onClick={e => e.stopPropagation()}
                    >
                        <form onSubmit={handleSave} style={{ display: 'contents' }}>
                            <div className="modal-header">
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{currentCredential ? 'Edit' : 'Add'} Connection</h2>
                                <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}><FiX size={20} /></button>
                            </div>

                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Label (Optional)</label>
                                    <input name="label" className="form-input" defaultValue={currentCredential?.label} placeholder="My AWS Server" />
                                </div>
                                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                                    <div>
                                        <label className="form-label">Host / IP</label>
                                        <input name="host" className="form-input" defaultValue={currentCredential?.host} required placeholder="192.168.1.1" />
                                    </div>
                                    <div>
                                        <label className="form-label">Port</label>
                                        <input name="port" className="form-input" defaultValue={currentCredential?.port || '22'} type="number" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Username</label>
                                    <input name="username" className="form-input" defaultValue={currentCredential?.username} required placeholder="root" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remote Path (Auto-CD)</label>
                                    <input name="remotePath" className="form-input" defaultValue={currentCredential?.remotePath} placeholder="/var/www/html" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Run Command</label>
                                    <input name="command" className="form-input" defaultValue={currentCredential?.command} placeholder="npm start" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password (Stored Encrypted)</label>
                                    <input
                                        name="password"
                                        type="password"
                                        className="form-input"
                                        defaultValue={currentCredential?.password}
                                        placeholder={currentCredential ? 'Leave blank to keep unchanged' : ''}
                                    />
                                    <small style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 8, display: 'block' }}>Optional. Used for copy-paste and auto-login.</small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tags (comma separated)</label>
                                    <input name="tags" className="form-input" defaultValue={currentCredential?.tags?.join(', ')} placeholder="prod, web, aws" />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn">Save Connection</button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Removed Master Password Modal */}

            </div>

            {/* Toast Container */}
            <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', zIndex: 9999 }}>
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            layout
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="toast"
                            style={{
                                borderColor: toast.type === 'error' ? 'var(--danger)' : toast.type === 'success' ? 'var(--success)' : 'var(--accent)',
                                pointerEvents: 'auto'
                            }}
                        >
                            {toast.type === 'success' && <FiCheck color="var(--success)" />}
                            {toast.type === 'error' && <FiX color="var(--danger)" />}
                            {toast.type === 'info' && <FiTerminal color="var(--accent)" />}
                            {toast.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default App;
