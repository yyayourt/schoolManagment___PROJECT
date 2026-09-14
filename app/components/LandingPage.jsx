"use client";

import React, { useState } from 'react';
import SchoolGeneratorForm from './SchoolGeneratorForm';

export default function LandingPage() {
    const [showGenerator, setShowGenerator] = useState(false);

    const enterGeneralDemo = () => {
        document.cookie = "force_falsy=true; path=/; max-age=86400";
        document.cookie = "is_landing_demo=true; path=/; max-age=86400";
        document.cookie = "x-school-key=demo_master; path=/; max-age=86400";
        document.cookie = "mock_role=admin; path=/; max-age=86400";
        window.location.reload();
    };

    return (
        <div className="landing">
            <style jsx global>{`
                .landing {
                    background: #090d16;
                    color: #f8fafc;
                    font-family: 'Outfit', 'Inter', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                /* Background Effects */
                .landing__glow {
                    position: absolute;
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%);
                    top: -10%;
                    left: -10%;
                    border-radius: 50%;
                    filter: blur(60px);
                    z-index: 0;
                    pointer-events: none;
                }
                .landing__glow--right {
                    left: auto;
                    right: -10%;
                    top: 20%;
                    background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%);
                }

                .landing__container {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: 0 24px;
                    position: relative;
                    z-index: 1;
                }

                /* Header */
                .landing__nav {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px 0;
                }
                .landing__logo {
                    font-size: 1.5rem;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .landing__logo-icon {
                    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 16px rgba(249,115,22,0.3);
                }

                /* Hero Section */
                .hero {
                    padding: 80px 0 120px 0;
                    text-align: center;
                }
                .hero__badge {
                    display: inline-block;
                    padding: 8px 16px;
                    background: rgba(249,115,22,0.1);
                    border: 1px solid rgba(249,115,22,0.2);
                    border-radius: 50px;
                    color: #ffedd5;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 24px;
                    animation: fadeInDown 0.6s ease;
                }
                .hero__title {
                    font-size: clamp(3rem, 5vw, 4.5rem);
                    font-weight: 900;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                    margin-bottom: 24px;
                    animation: fadeInUp 0.6s ease 0.1s both;
                }
                .hero__title-highlight {
                    background: linear-gradient(90deg, #f97316 0%, #fcd34d 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .hero__subtitle {
                    font-size: 1.25rem;
                    color: #94a3b8;
                    max-width: 680px;
                    margin: 0 auto 40px auto;
                    line-height: 1.6;
                    animation: fadeInUp 0.6s ease 0.2s both;
                }
                .hero__actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 16px;
                    animation: fadeInUp 0.6s ease 0.3s both;
                }
                .btn {
                    padding: 16px 36px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 1.05rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    border: none;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                }
                .btn--primary {
                    background: #f97316;
                    color: #fff;
                    box-shadow: 0 0 30px rgba(249,115,22,0.3);
                }
                .btn--primary:hover {
                    background: #ea580c;
                    transform: translateY(-2px);
                    box-shadow: 0 0 40px rgba(249,115,22,0.5);
                }
                .btn--secondary {
                    background: rgba(255,255,255,0.05);
                    color: #f8fafc;
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(12px);
                }
                .btn--secondary:hover {
                    background: rgba(255,255,255,0.1);
                    transform: translateY(-2px);
                    border-color: rgba(255,255,255,0.2);
                }

                /* Social Proof */
                .proof {
                    display: flex;
                    justify-content: center;
                    gap: 40px;
                    margin-top: 60px;
                    padding-top: 40px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    animation: fadeInUp 0.6s ease 0.4s both;
                }
                .proof__item {
                    text-align: center;
                }
                .proof__num {
                    font-size: 2rem;
                    font-weight: 800;
                    color: #f8fafc;
                    display: block;
                }
                .proof__label {
                    color: #64748b;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                /* Bento Grid Section */
                .features {
                    padding: 80px 0;
                }
                .features__title {
                    font-size: 2.5rem;
                    text-align: center;
                    margin-bottom: 60px;
                    font-weight: 800;
                }
                .bento {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                }
                .bento__item {
                    background: rgba(15,23,42,0.4);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 24px;
                    padding: 32px;
                    position: relative;
                    overflow: hidden;
                    backdrop-filter: blur(10px);
                    transition: transform 0.3s, border-color 0.3s;
                }
                .bento__item:hover {
                    transform: translateY(-5px);
                    border-color: rgba(249,115,22,0.3);
                }
                .bento__item--large {
                    grid-column: span 2;
                }
                .bento__icon {
                    font-size: 2.5rem;
                    margin-bottom: 24px;
                    display: inline-block;
                }
                .bento__item h3 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 12px;
                }
                .bento__item p {
                    color: #94a3b8;
                    line-height: 1.6;
                }
                
                /* Modal Styles */
                /* (Rest of modal styles perfectly preserved from previous but upgraded) */
                .landing-modal {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(5,8,15,0.85);
                    backdrop-filter: blur(12px);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 1000;
                    animation: fadeIn 0.3s ease;
                }
                .landing-modal__content {
                    background: #0f172a;
                    border: 1px solid rgba(249,115,22,0.3);
                    padding: 40px;
                    border-radius: 28px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(249,115,22,0.1);
                    animation: scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .landing-modal__title { font-size: 1.75rem; font-weight: 800; color: #fff; margin-bottom: 8px;}
                .landing-modal__subtitle { color: #94a3b8; margin-bottom: 24px; line-height: 1.5;}
                .landing-modal__form-group { margin-bottom: 20px;}
                .landing-modal__label { display: block; color: #cbd5e1; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem;}
                .landing-modal__input, .landing-modal__select {
                    width: 100%;
                    padding: 14px;
                    background: #1e293b;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    color: #fff;
                    font-family: inherit;
                    font-size: 1rem;
                }
                .landing-modal__input:focus, .landing-modal__select:focus {
                    outline: none; border-color: #f97316;
                }
                .landing-modal__btn-group { display: flex; gap: 12px; margin-top: 32px;}
                .landing-modal__btn { flex: 1; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s;}
                .landing-modal__btn--submit { background: #f97316; color: #fff;}
                .landing-modal__btn--submit:hover { background: #ea580c;}
                .landing-modal__btn--cancel { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1;}
                .landing-modal__btn--cancel:hover { background: rgba(255,255,255,0.05);}

                /* Animations */
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

                @media (max-width: 900px) {
                    .bento { grid-template-columns: 1fr; }
                    .bento__item--large { grid-column: span 1; }
                    .proof { flex-wrap: wrap; gap: 20px; }
                }
            `}</style>

            <div className="landing__glow"></div>
            <div className="landing__glow landing__glow--right"></div>

            <div className="landing__container">
                <nav className="landing__nav">
                    <div className="landing__logo">
                        <div className="landing__logo-icon">🏫</div>
                        ESMP Cloud
                    </div>
                </nav>

                <main>
                    {/* HERO */}
                    <section className="hero">
                        <span className="hero__badge">✨ La révolution SaaS pour les établissements</span>
                        <h1 className="hero__title">
                            Le premier ERP Scolaire conçu pour l'Humain,<br/>
                            <span className="hero__title-highlight">propulsé par l'IA.</span>
                        </h1>
                        <p className="hero__subtitle">
                            Oubliez les usines à gaz obsolètes. Notre plateforme offre une vitesse fulgurante sans rechargement de page, une extraction intelligente des documents, et un suivi en temps réel pour parents et professeurs.
                        </p>
                        
                        <div className="hero__actions">
                            <button className="btn btn--primary" onClick={enterGeneralDemo}>
                                🚀 Accéder à la Démo Immédiate
                            </button>
                            <button className="btn btn--secondary" onClick={() => setShowGenerator(true)}>
                                🏗️ Créer mon école bac à sable
                            </button>
                        </div>

                        <div className="proof">
                            <div className="proof__item">
                                <span className="proof__num">0s</span>
                                <span className="proof__label">Temps de chargement</span>
                            </div>
                            <div className="proof__item">
                                <span className="proof__num">+4h</span>
                                <span className="proof__label">Gagnées par prof/sem.</span>
                            </div>
                            <div className="proof__item">
                                <span className="proof__num">100%</span>
                                <span className="proof__label">Étanchéité Multi-Tenant</span>
                            </div>
                        </div>
                    </section>

                    {/* FEATURES BENTO GRID */}
                    <section className="features">
                        <h2 className="features__title">Pourquoi changer d'outil dès maintenant ?</h2>
                        <div className="bento">
                            <div className="bento__item bento__item--large">
                                <span className="bento__icon">⚡</span>
                                <h3>Vitesse Fulgurante (Next.js)</h3>
                                <p>Contrairement aux logiciels classiques, notre architecture SPA (Single Page Application) supprime totalement les temps de chargement frustrants. Cliquez sur une classe, un élève ou un emploi du temps : l'affichage est <strong>instantané</strong>.</p>
                            </div>
                            <div className="bento__item">
                                <span className="bento__icon">🤖</span>
                                <h3>IA d'Extraction</h3>
                                <p>Prenez en photo un cahier de texte physique ou un relevé de notes brouillon. Notre IA s'occupe de numériser, analyser et classer la donnée sans effort manuel.</p>
                            </div>
                            <div className="bento__item">
                                <span className="bento__icon">🔐</span>
                                <h3>Isolation RBAC Stricte</h3>
                                <p>Des espaces hermétiques dédiés. Un parent ne voit que ses enfants, un élève ne voit que ses devoirs. Sécurité multi-tenant garantie par base de données.</p>
                            </div>
                            <div className="bento__item bento__item--large">
                                <span className="bento__icon">💬</span>
                                <h3>Messagerie & Groupes Intégrés</h3>
                                <p>Plus besoin de WhatsApp ou d'emails dispersés. Des groupes de discussion (Parents-Profs, Classes) et une visioconférence intégrée directement dans le tableau de bord scolaire pour une communication transparente.</p>
                            </div>
                        </div>
                    </section>
                </main>
            </div>

            {showGenerator && (
                <div className="school-generator-modal" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowGenerator(false); }}>
                    <div className="school-generator-modal__dialog">
                        <SchoolGeneratorForm
                            mode="sandbox"
                            onCancel={() => setShowGenerator(false)}
                            onSuccess={() => { window.location.reload(); }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
