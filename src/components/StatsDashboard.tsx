import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Flame, Target, CalendarDays, Award, Settings } from 'lucide-react';
import { useStats } from '../hooks/useStats';

export const StatsDashboard: React.FC = () => {
  const { stats, isStatsLoaded, updateGoals, getTodayString } = useStats();
  const [isEditingDaily, setIsEditingDaily] = useState(false);
  const [isEditingLongTerm, setIsEditingLongTerm] = useState(false);
  
  const [dailyForm, setDailyForm] = useState(stats.goals.daily);
  const [longTermForm, setLongTermForm] = useState(stats.goals.longTerm);

  // Sync form state when stats load from cloud/localStorage
  useEffect(() => {
    if (isStatsLoaded) {
      setDailyForm(stats.goals.daily);
      setLongTermForm(stats.goals.longTerm);
    }
  }, [isStatsLoaded]);

  if (!isStatsLoaded) return null;

  const today = getTodayString();
  const todayStats = stats.history[today] || { xp: 0, studyMinutes: 0, lessonsCompleted: 0 };
  
  const xpPercent = stats.goals.daily.xp > 0 ? Math.min(100, Math.round((todayStats.xp / stats.goals.daily.xp) * 100)) : 0;
  const minPercent = stats.goals.daily.minutes > 0 ? Math.min(100, Math.round((todayStats.studyMinutes / stats.goals.daily.minutes) * 100)) : 0;
  const lessonPercent = stats.goals.daily.lessons > 0 ? Math.min(100, Math.round((todayStats.lessonsCompleted / stats.goals.daily.lessons) * 100)) : 0;

  // Calculate real weekly XP from history
  const todayDate = new Date();
  const currentDayOfWeek = todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1;
  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  
  const getWeekDates = () => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - currentDayOfWeek + i);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      dates.push(dateStr);
    }
    return dates;
  };
  const weekDates = getWeekDates();
  const weeklyXP = weekDates.reduce((sum, d) => sum + (stats.history[d]?.xp || 0), 0);
  const studyDaysThisWeek = weekDates.filter(d => (stats.history[d]?.xp || 0) > 0).length;

  const saveDailyGoals = () => {
    updateGoals({ ...stats.goals, daily: dailyForm });
    setIsEditingDaily(false);
  };

  const saveLongTermGoals = () => {
    updateGoals({ ...stats.goals, longTerm: longTermForm });
    setIsEditingLongTerm(false);
  };
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#f8f9fb]">
      <div className="max-w-2xl mx-auto w-full p-4 space-y-5 pb-20">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
          className="bg-gradient-to-br from-[#1a56db] to-blue-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Target size={80} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Target size={20} className="text-blue-200" /> Mục tiêu của tôi
            </h2>
            <div className="flex gap-2 flex-wrap">
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 border border-white/10">
                <Flame size={16} className="text-orange-300 fill-orange-300" /> 
                <span>🔥 Lửa rực</span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 border border-white/10">
                <Award size={16} className="text-yellow-300" /> 
                <span>{stats.totalXP} XP tổng</span>
              </div>
              <div className="bg-blue-400/40 backdrop-blur-sm px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 border border-white/10 ml-auto">
                <span>Hôm nay +{todayStats.xp} XP</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Hôm nay */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <SparklesIcon />
            <h3 className="font-bold text-slate-800 text-lg">Hôm nay</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <ProgressCard title="XP HÔM NAY" current={todayStats.xp} target={stats.goals.daily.xp} percent={xpPercent} color="blue" />
            <ProgressCard title="PHÚT HỌC" current={todayStats.studyMinutes} target={stats.goals.daily.minutes} percent={minPercent} color="purple" />
            <ProgressCard title="BÀI XONG" current={todayStats.lessonsCompleted} target={stats.goals.daily.lessons} percent={lessonPercent} color="green" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-700 text-sm">Tuỳ chỉnh mục tiêu hàng ngày</h4>
              <button onClick={() => setIsEditingDaily(!isEditingDaily)} className="text-slate-400 hover:text-[#1a56db]"><Settings size={16} /></button>
            </div>
            
            {isEditingDaily ? (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <InputBox label="XP / ngày" value={dailyForm.xp} onChange={v => setDailyForm({...dailyForm, xp: parseInt(v)||0})} />
                  <InputBox label="Phút / ngày" value={dailyForm.minutes} onChange={v => setDailyForm({...dailyForm, minutes: parseInt(v)||0})} />
                  <InputBox label="Bài / ngày" value={dailyForm.lessons} onChange={v => setDailyForm({...dailyForm, lessons: parseInt(v)||0})} />
                </div>
                <button onClick={saveDailyGoals} className="w-full py-2 bg-[#1a56db] text-white font-bold rounded-xl text-sm active:scale-95">Lưu mục tiêu ngày</button>
              </div>
            ) : (
              <div className="flex gap-3 text-sm text-slate-500 font-medium">
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">{stats.goals.daily.xp} XP</div>
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">{stats.goals.daily.minutes} phút</div>
                <div className="flex-1 bg-slate-50 rounded-xl p-2 text-center">{stats.goals.daily.lessons} bài</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tuần này */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[#1a56db]" />
            <h3 className="font-bold text-slate-800 text-lg">Tuần này</h3>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            {/* Week Progress */}
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              <span>XP tuần: {weeklyXP} / {stats.goals.weekly.xp}</span>
              <span>Ngày học: {studyDaysThisWeek} / {stats.goals.weekly.studyDays}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, stats.goals.weekly.xp > 0 ? (weeklyXP / stats.goals.weekly.xp) * 100 : 0)}%` }}></div>
            </div>

            {/* Days row */}
            <div className="flex gap-1 sm:gap-2 mb-4 justify-between">
              {weekDays.map((day, idx) => {
                const dateStr = weekDates[idx];
                const dayXP = stats.history[dateStr]?.xp || 0;
                const isActive = dayXP > 0;
                const isToday = idx === currentDayOfWeek;
                return (
                  <div key={day} className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm text-[#1a56db]' : isToday ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                    <span className="text-[10px] font-bold mb-1">{day}</span>
                    {isActive ? <Flame size={16} className="text-orange-500 fill-orange-500 mb-0.5" /> : <div className="w-1 h-1 rounded-full bg-slate-300 mb-2 mt-1"></div>}
                    <span className="text-[10px] font-bold">{dayXP > 0 ? `${dayXP} XP` : '0 XP'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Mục tiêu dài hạn */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-pink-500" />
            <h3 className="font-bold text-slate-800 text-lg">Mục tiêu dài hạn</h3>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            {isEditingLongTerm ? (
              <div className="space-y-3">
                <div className="flex gap-3 flex-col sm:flex-row">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cấp độ đích</label>
                    <select value={longTermForm.targetLevel} onChange={e => setLongTermForm({...longTermForm, targetLevel: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1a56db]">
                      <option value="DELF A1">DELF A1</option>
                      <option value="DELF A2">DELF A2</option>
                      <option value="DELF B1">DELF B1</option>
                      <option value="DELF B2">DELF B2</option>
                      <option value="DALF C1">DALF C1</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Deadline</label>
                    <input type="date" value={longTermForm.deadline} onChange={e => setLongTermForm({...longTermForm, deadline: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a56db]" />
                  </div>
                </div>
                <button onClick={saveLongTermGoals} className="w-full py-2.5 bg-pink-500 text-white font-bold rounded-xl text-sm active:scale-95">Lưu mục tiêu dài hạn</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500 mb-3">Bạn đang hướng tới mục tiêu <strong>{stats.goals.longTerm.targetLevel}</strong> vào ngày <strong>{new Date(stats.goals.longTerm.deadline).toLocaleDateString('vi-VN')}</strong>.</p>
                <button onClick={() => { setLongTermForm(stats.goals.longTerm); setIsEditingLongTerm(true); }} className="w-full py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 active:scale-95">Cập nhật mục tiêu</button>
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

const ProgressCard: React.FC<{ title: string; current: number; target: number; percent: number; color: 'blue' | 'purple' | 'green' }> = ({ title, current, target, percent, color }) => {
  const gradients = {
    blue: 'from-[#1a56db] to-blue-400',
    purple: 'from-purple-500 to-fuchsia-400',
    green: 'from-emerald-500 to-teal-400',
  };
  const textColors = {
    blue: 'text-[#1a56db]',
    purple: 'text-purple-600',
    green: 'text-emerald-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col justify-between">
      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="flex items-end gap-1 mb-2">
        <span className={`text-2xl font-black leading-none ${textColors[color]}`}>{current}</span>
        <span className="text-xs text-slate-400 font-bold mb-0.5">/ {target}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-auto">
        <div className={`h-full bg-gradient-to-r ${gradients[color]} transition-all`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
};

const InputBox: React.FC<{ label: string; value: number; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex-1">
    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
    <input type="number" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#1a56db]" />
  </div>
);

const SparklesIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#1a56db"/>
  </svg>
);
