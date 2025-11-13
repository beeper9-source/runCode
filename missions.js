let currentEditId = null;

// 미션 목록 로드
async function loadMissions() {
    try {
        const yearFilter = document.getElementById('yearFilter').value;
        const activeFilter = document.getElementById('activeFilter').value;

        let query = supabase
            .from('rc_weekly_mission')
            .select('*')
            .order('year', { ascending: false })
            .order('week_number', { ascending: false });

        if (yearFilter) {
            query = query.eq('year', parseInt(yearFilter));
        }

        if (activeFilter !== '') {
            query = query.eq('is_active', activeFilter === 'true');
        }

        const { data: missions, error } = await query;

        if (error) throw error;

        displayMissions(missions);
        populateYearFilter(missions);
    } catch (error) {
        console.error('미션 목록 로드 오류:', error);
        showAlert('미션 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 연도 필터 채우기
function populateYearFilter(missions) {
    const years = [...new Set(missions.map(m => m.year))].sort((a, b) => b - a);
    const select = document.getElementById('yearFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">전체 연도</option>' + 
        years.map(year => `<option value="${year}">${year}년</option>`).join('');
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// 미션 표시
function displayMissions(missions) {
    const container = document.getElementById('missionsList');
    
    if (!missions || missions.length === 0) {
        container.innerHTML = '<div class="empty-state">등록된 미션이 없습니다.</div>';
        return;
    }

    container.innerHTML = missions.map(mission => {
        const startDate = new Date(mission.start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(mission.end_date).toLocaleDateString('ko-KR');
        const isActive = mission.is_active;
        
        return `
            <div class="mission-card" onclick="showMissionDetail(${mission.mission_id})">
                <h3>${mission.title} ${isActive ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-warning">비활성</span>'}</h3>
                <div class="meta">
                    <span>${mission.year}년 ${mission.week_number}주차</span>
                    <span>${startDate} ~ ${endDate}</span>
                    ${mission.target_distance ? `<span>목표: ${parseFloat(mission.target_distance).toFixed(1)} km</span>` : ''}
                </div>
                ${mission.description ? `<p style="color: #666; margin-top: 10px;">${mission.description}</p>` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); editMission(${mission.mission_id})">수정</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteMission(${mission.mission_id})">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

// 미션 상세 보기
async function showMissionDetail(missionId) {
    try {
        const { data: mission, error } = await supabase
            .from('rc_weekly_mission')
            .select('*')
            .eq('mission_id', missionId)
            .single();

        if (error) throw error;

        // 진행률 계산
        const progress = await calculateMissionProgress(missionId, mission);

        const startDate = new Date(mission.start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(mission.end_date).toLocaleDateString('ko-KR');

        let content = `
            <div>
                <h3 style="margin-bottom: 15px;">${mission.title}</h3>
                <div style="margin-bottom: 20px; color: #666;">
                    <p><strong>년도/주차:</strong> ${mission.year}년 ${mission.week_number}주차</p>
                    <p><strong>기간:</strong> ${startDate} ~ ${endDate}</p>
                    ${mission.target_distance ? `<p><strong>목표 거리:</strong> ${parseFloat(mission.target_distance).toFixed(1)} km</p>` : ''}
                    <p><strong>상태:</strong> ${mission.is_active ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-warning">비활성</span>'}</p>
                    ${mission.description ? `<p style="margin-top: 15px;"><strong>설명:</strong><br>${mission.description}</p>` : ''}
                </div>

                <div class="team-progress">
                    <h4 style="margin-bottom: 20px;">조별 진행 현황</h4>
        `;

        // 조별 진행률 표시
        const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
        progress.forEach(teamProgress => {
            const achievementRate = teamProgress.achievement_rate || 0;
            const progressWidth = Math.min(achievementRate, 200); // 최대 200%까지 표시
            
            content += `
                <div class="team-progress-item">
                    <h4>${teamProgress.team}조</h4>
                    <p>총 거리: ${teamProgress.total_distance.toFixed(1)} km</p>
                    <p>회원 수: ${teamProgress.member_count}명</p>
                    <p>평균 거리: ${teamProgress.average_distance.toFixed(1)} km</p>
                    <p>달성률: ${achievementRate.toFixed(1)}%</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressWidth}%;">
                            ${achievementRate.toFixed(1)}%
                        </div>
                    </div>
                </div>
            `;
        });

        content += `
                </div>
            </div>
        `;

        document.getElementById('detailModalTitle').textContent = mission.title;
        document.getElementById('missionDetailContent').innerHTML = content;
        document.getElementById('missionDetailModal').classList.add('active');
    } catch (error) {
        console.error('미션 상세 로드 오류:', error);
        showAlert('미션 상세 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 진행률 계산
async function calculateMissionProgress(missionId, mission) {
    try {
        const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
        const progress = [];

        for (const team of teams) {
            // 조별 회원 가져오기
            const { data: members, error: membersError } = await supabase
                .from('rc_member')
                .select('member_id')
                .eq('team', team);

            if (membersError) throw membersError;

            const memberIds = members.map(m => m.member_id);
            
            if (memberIds.length === 0) {
                progress.push({
                    team: team,
                    total_distance: 0,
                    member_count: 0,
                    average_distance: 0,
                    achievement_rate: 0
                });
                continue;
            }

            // 기간 내 런닝 기록 가져오기
            const { data: records, error: recordsError } = await supabase
                .from('rc_running_record')
                .select('distance')
                .in('member_id', memberIds)
                .gte('running_date', mission.start_date)
                .lte('running_date', mission.end_date);

            if (recordsError) throw recordsError;

            const totalDistance = records.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0);
            const memberCount = memberIds.length;
            const averageDistance = memberCount > 0 ? totalDistance / memberCount : 0;
            const achievementRate = mission.target_distance && mission.target_distance > 0
                ? (averageDistance / mission.target_distance) * 100
                : 0;

            progress.push({
                team: team,
                total_distance: totalDistance,
                member_count: memberCount,
                average_distance: averageDistance,
                achievement_rate: achievementRate
            });
        }

        // 달성률 기준으로 정렬
        progress.sort((a, b) => b.achievement_rate - a.achievement_rate);

        return progress;
    } catch (error) {
        console.error('진행률 계산 오류:', error);
        return [];
    }
}

// 미션 등록 모달 열기
function openMissionModal(missionId = null) {
    currentEditId = missionId;
    const modal = document.getElementById('missionModal');
    const form = document.getElementById('missionForm');
    const title = document.getElementById('modalTitle');

    if (missionId) {
        title.textContent = '미션 수정';
        loadMissionData(missionId);
    } else {
        title.textContent = '미션 등록';
        form.reset();
        document.getElementById('missionId').value = '';
        document.getElementById('year').value = new Date().getFullYear();
        document.getElementById('isActive').checked = true;
    }

    modal.classList.add('active');
}

// 미션 데이터 로드 (수정용)
async function loadMissionData(missionId) {
    try {
        const { data, error } = await supabase
            .from('rc_weekly_mission')
            .select('*')
            .eq('mission_id', missionId)
            .single();

        if (error) throw error;

        document.getElementById('missionId').value = data.mission_id;
        document.getElementById('year').value = data.year;
        document.getElementById('weekNumber').value = data.week_number;
        document.getElementById('title').value = data.title;
        document.getElementById('description').value = data.description || '';
        document.getElementById('targetDistance').value = data.target_distance || '';
        document.getElementById('startDate').value = data.start_date;
        document.getElementById('endDate').value = data.end_date;
        document.getElementById('isActive').checked = data.is_active;
    } catch (error) {
        console.error('미션 데이터 로드 오류:', error);
        showAlert('미션 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 수정
function editMission(missionId) {
    openMissionModal(missionId);
}

// 미션 저장
async function saveMission(event) {
    event.preventDefault();

    try {
        const missionId = document.getElementById('missionId').value;
        const missionData = {
            year: parseInt(document.getElementById('year').value),
            week_number: parseInt(document.getElementById('weekNumber').value),
            title: document.getElementById('title').value,
            description: document.getElementById('description').value || null,
            target_distance: document.getElementById('targetDistance').value ? parseFloat(document.getElementById('targetDistance').value) : null,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            is_active: document.getElementById('isActive').checked
        };

        // 날짜 검증
        if (new Date(missionData.end_date) < new Date(missionData.start_date)) {
            showAlert('종료일은 시작일보다 이후여야 합니다.', 'error');
            return;
        }

        let result;
        if (missionId) {
            // 수정
            const { data, error } = await supabase
                .from('rc_weekly_mission')
                .update(missionData)
                .eq('mission_id', missionId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            showAlert('미션이 수정되었습니다.', 'success');
        } else {
            // 등록
            const { data, error } = await supabase
                .from('rc_weekly_mission')
                .insert([missionData])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            showAlert('미션이 등록되었습니다.', 'success');
        }

        closeMissionModal();
        loadMissions();
    } catch (error) {
        console.error('미션 저장 오류:', error);
        showAlert('미션 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 미션 삭제
async function deleteMission(missionId) {
    if (!confirm('정말로 이 미션을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('rc_weekly_mission')
            .delete()
            .eq('mission_id', missionId);

        if (error) throw error;

        showAlert('미션이 삭제되었습니다.', 'success');
        loadMissions();
    } catch (error) {
        console.error('미션 삭제 오류:', error);
        showAlert('미션 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 모달 닫기
function closeMissionModal() {
    document.getElementById('missionModal').classList.remove('active');
    document.getElementById('missionForm').reset();
    currentEditId = null;
}

function closeMissionDetailModal() {
    document.getElementById('missionDetailModal').classList.remove('active');
}

// 알림 표시
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = `alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass}`;
    alertDiv.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadMissions);

