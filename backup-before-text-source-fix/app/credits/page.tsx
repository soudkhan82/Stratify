"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.10)] md:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
            <Sparkles className="h-4 w-4" />
            Credits
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[#4338ca] md:text-5xl">
                Stratify Analytics
              </h1>

              <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-700">
                Stratify is a modern world intelligence and analytics portal
                designed to bring trusted global datasets into one clean, fast,
                and decision-ready platform. It combines country profiles,
                development indicators, debt sustainability, energy insights,
                fiscal metrics, FAOSTAT data, and corporate intelligence into a
                structured dashboard experience for analysts, researchers,
                policymakers, and business users.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-3xl border border-white bg-white shadow-md">
                <Image
                  src="/saud-arshad-khan.jpg"
                  alt="Saud Arshad Khan - Lead Developer and Architect of Stratify Analytics"
                  fill
                  priority
                  sizes="(max-width: 768px) 280px, 320px"
                  className="object-cover object-top"
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-lg font-black text-slate-950">
                  Saud Arshad Khan
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                  Lead Developer & Architect
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <ShieldCheck className="mb-3 h-6 w-6 text-emerald-600" />
              <h3 className="text-sm font-black text-slate-950">
                Data Intelligence
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Built around public and curated global datasets for structured
                economic, fiscal, agricultural, and development analysis.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <ShieldCheck className="mb-3 h-6 w-6 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-950">
                Decision Support
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Designed to simplify comparison, ranking, trend exploration, and
                country-level intelligence through interactive dashboards.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <ShieldCheck className="mb-3 h-6 w-6 text-blue-600" />
              <h3 className="text-sm font-black text-slate-950">
                Clean Analytics UX
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Focused on compact, professional, and accessible visual
                experiences for quick exploration and analytical storytelling.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
              Lead Developer & Architect
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Saud Arshad Khan
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              Saud Arshad Khan is the lead developer and architect behind
              Stratify Analytics. The platform reflects his work in data
              engineering, analytical dashboard design, full-stack development,
              and decision-intelligence systems. His focus is to transform
              complex public datasets into practical, usable, and visually clear
              intelligence products.
            </p>
          </div>

          <footer className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="font-semibold">
                Product: Stratify Analytics / WorldStats360
              </p>

              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-500" />
                  +92-3174364189
                </span>

                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-500" />
                  soudkhan82@gmail.com
                </span>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
