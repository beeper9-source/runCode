// 대시보드 데이터 로드
async function loadDashboard() {
    try {
        // 전체 회원 수
        const { count: memberCount } = await supabase
            .from('rc_member')
            .select('*', { count: 'exact', head: true });
        
        document.getElementById('totalMembers').textContent = memberCount || 0;

        // 이번 달 날짜 범위
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // 이번 달 런닝 기록
        const { data: records, error: recordsError } = await supabase
            .from('rc_running_record')
            .select('distance, running_time')
            .gte('running_date', firstDay.toISOString().split('T')[0])
            .lte('running_date', lastDay.toISOString().split('T')[0]);

        if (recordsError) throw recordsError;

        const totalDistance = records?.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0) || 0;
        const runCount = records?.length || 0;

        document.getElementById('monthlyDistance').textContent = totalDistance.toFixed(1) + ' km';
        document.getElementById('monthlyRuns').textContent = runCount;

        // 진행 중인 미션 수
        const today = new Date().toISOString().split('T')[0];
        const { count: missionCount } = await supabase
            .from('rc_weekly_mission')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .lte('start_date', today)
            .gte('end_date', today);
        
        document.getElementById('activeMissions').textContent = missionCount || 0;

        // 최근 런닝 기록 (최대 10개)
        const { data: recentRecords, error: recentError } = await supabase
            .from('rc_running_record')
            .select(`
                running_date,
                distance,
                running_time,
                pace,
                rc_member(name)
            `)
            .order('running_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10);

        if (recentError) throw recentError;

        const tbody = document.getElementById('recentRecords');
        if (recentRecords && recentRecords.length > 0) {
            tbody.innerHTML = recentRecords.map(record => `
                <tr>
                    <td>${new Date(record.running_date).toLocaleDateString('ko-KR')}</td>
                    <td>${record.rc_member?.name || '-'}</td>
                    <td>${parseFloat(record.distance).toFixed(2)}</td>
                    <td>${record.running_time}</td>
                    <td>${record.pace || '-'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">기록이 없습니다.</td></tr>';
        }
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
        document.getElementById('recentRecords').innerHTML = 
            '<tr><td colspan="5" class="empty-state">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>';
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadDashboard);

