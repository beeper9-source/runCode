let currentEditId = null;

// 회원 목록 로드 (드롭다운용)
async function loadMembersForDropdown() {
    try {
        const { data: members, error } = await supabase
            .from('rc_member')
            .select('member_id, name')
            .order('name', { ascending: true });

        if (error) throw error;

        const select = document.getElementById('memberFilter');
        const modalSelect = document.getElementById('memberId');

        const options = members.map(m => 
            `<option value="${m.member_id}">${m.name}</option>`
        ).join('');

        select.innerHTML = '<option value="">전체 회원</option>' + options;
        modalSelect.innerHTML = '<option value="">선택하세요</option>' + options;
    } catch (error) {
        console.error('회원 목록 로드 오류:', error);
    }
}

// 기록 목록 로드
async function loadRecords() {
    try {
        const memberId = document.getElementById('memberFilter').value;
        const period = document.getElementById('periodFilter').value;
        
        let startDate = null;
        let endDate = null;

        if (period === 'week') {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            startDate = new Date(now.setDate(diff));
            endDate = new Date();
        } else if (period === 'month') {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'custom') {
            startDate = document.getElementById('startDate').value;
            endDate = document.getElementById('endDate').value;
            document.getElementById('startDate').style.display = 'inline-block';
            document.getElementById('endDate').style.display = 'inline-block';
        } else {
            document.getElementById('startDate').style.display = 'none';
            document.getElementById('endDate').style.display = 'none';
        }

        let query = supabase
            .from('rc_running_record')
            .select(`
                record_id,
                running_date,
                distance,
                running_time,
                pace,
                memo,
                rc_member(name)
            `)
            .order('running_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (memberId) {
            query = query.eq('member_id', memberId);
        }

        if (startDate) {
            query = query.gte('running_date', startDate.toISOString().split('T')[0]);
        }

        if (endDate) {
            const endDateStr = endDate instanceof Date 
                ? endDate.toISOString().split('T')[0]
                : endDate;
            query = query.lte('running_date', endDateStr);
        }

        const { data: records, error } = await query;

        if (error) throw error;

        displayRecords(records);
        calculateStatistics(records);
    } catch (error) {
        console.error('기록 목록 로드 오류:', error);
        showAlert('기록 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 기록 표시
function displayRecords(records) {
    const tbody = document.getElementById('recordsTable');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">등록된 기록이 없습니다.</td></tr>';
        document.getElementById('statisticsCards').style.display = 'none';
        return;
    }

    document.getElementById('statisticsCards').style.display = 'grid';

    tbody.innerHTML = records.map(record => `
        <tr>
            <td>${new Date(record.running_date).toLocaleDateString('ko-KR')}</td>
            <td>${record.rc_member?.name || '-'}</td>
            <td>${parseFloat(record.distance).toFixed(2)}</td>
            <td>${record.running_time}</td>
            <td>${record.pace || '-'}</td>
            <td>${record.memo || '-'}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="editRecord(${record.record_id})">수정</button>
                <button class="btn btn-small btn-danger" onclick="deleteRecord(${record.record_id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

// 통계 계산
function calculateStatistics(records) {
    if (!records || records.length === 0) {
        document.getElementById('statisticsCards').style.display = 'none';
        return;
    }

    const totalDistance = records.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0);
    
    // 총 시간 계산
    let totalSeconds = 0;
    records.forEach(r => {
        if (r.running_time) {
            const [hours, minutes, seconds] = r.running_time.split(':').map(Number);
            totalSeconds += hours * 3600 + minutes * 60 + seconds;
        }
    });
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMins = Math.floor((totalSeconds % 3600) / 60);
    const totalSecs = totalSeconds % 60;
    const totalTimeStr = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;

    // 평균 페이스 계산
    let averagePace = '-';
    if (totalDistance > 0 && totalSeconds > 0) {
        const paceSeconds = totalSeconds / totalDistance;
        const paceMins = Math.floor(paceSeconds / 60);
        const paceSecs = Math.floor(paceSeconds % 60);
        averagePace = `${String(paceMins).padStart(2, '0')}:${String(paceSecs).padStart(2, '0')}`;
    }

    document.getElementById('totalDistance').textContent = totalDistance.toFixed(1) + ' km';
    document.getElementById('totalTime').textContent = totalTimeStr;
    document.getElementById('averagePace').textContent = averagePace;
    document.getElementById('runCount').textContent = records.length;
}

// 페이스 계산
function calculatePace() {
    const distance = parseFloat(document.getElementById('distance').value);
    const timeStr = document.getElementById('runningTime').value;

    if (!distance || !timeStr || timeStr.length < 8) {
        document.getElementById('pace').value = '';
        return;
    }

    try {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        const paceSeconds = totalSeconds / distance;
        const paceMins = Math.floor(paceSeconds / 60);
        const paceSecs = Math.floor(paceSeconds % 60);
        const paceStr = `${String(paceMins).padStart(2, '0')}:${String(paceSecs).padStart(2, '0')}:00`;
        document.getElementById('pace').value = paceStr;
    } catch (error) {
        document.getElementById('pace').value = '';
    }
}

// 기록 등록 모달 열기
function openRecordModal(recordId = null) {
    currentEditId = recordId;
    const modal = document.getElementById('recordModal');
    const form = document.getElementById('recordForm');
    const title = document.getElementById('modalTitle');

    if (recordId) {
        title.textContent = '기록 수정';
        loadRecordData(recordId);
    } else {
        title.textContent = '기록 등록';
        form.reset();
        document.getElementById('recordId').value = '';
        document.getElementById('runningDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('bestRecordBadge').style.display = 'none';
    }

    modal.classList.add('active');
}

// 기록 데이터 로드 (수정용)
async function loadRecordData(recordId) {
    try {
        const { data, error } = await supabase
            .from('rc_running_record')
            .select('*')
            .eq('record_id', recordId)
            .single();

        if (error) throw error;

        document.getElementById('recordId').value = data.record_id;
        document.getElementById('memberId').value = data.member_id;
        document.getElementById('runningDate').value = data.running_date;
        document.getElementById('distance').value = data.distance;
        document.getElementById('runningTime').value = data.running_time;
        document.getElementById('pace').value = data.pace || '';
        document.getElementById('memo').value = data.memo || '';
        calculatePace();
    } catch (error) {
        console.error('기록 데이터 로드 오류:', error);
        showAlert('기록 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 기록 수정
function editRecord(recordId) {
    openRecordModal(recordId);
}

// 기록 저장
async function saveRecord(event) {
    event.preventDefault();

    try {
        const recordId = document.getElementById('recordId').value;
        const distance = parseFloat(document.getElementById('distance').value);
        const runningTime = document.getElementById('runningTime').value;

        const recordData = {
            member_id: parseInt(document.getElementById('memberId').value),
            running_date: document.getElementById('runningDate').value,
            distance: distance,
            running_time: runningTime,
            memo: document.getElementById('memo').value || null
        };

        let result;
        if (recordId) {
            // 수정
            const { data, error } = await supabase
                .from('rc_running_record')
                .update(recordData)
                .eq('record_id', recordId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            showAlert('기록이 수정되었습니다.', 'success');
        } else {
            // 등록
            const { data, error } = await supabase
                .from('rc_running_record')
                .insert([recordData])
                .select()
                .single();
            
            if (error) throw error;
            result = data;

            // 개인 베스트 기록 확인 및 업데이트
            const isBest = await checkAndUpdatePersonalBest(result.member_id, distance, runningTime);
            if (isBest) {
                document.getElementById('bestRecordBadge').style.display = 'block';
            }

            showAlert('기록이 등록되었습니다.', 'success');
        }

        closeRecordModal();
        loadRecords();
    } catch (error) {
        console.error('기록 저장 오류:', error);
        showAlert('기록 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 개인 베스트 기록 확인 및 업데이트
async function checkAndUpdatePersonalBest(memberId, distance, runningTime) {
    try {
        // 거리 범위별 카테고리 판정
        let category = null;
        if (9.5 <= distance && distance <= 10.5) {
            category = 'best_10km';
        } else if (20.5 <= distance && distance <= 21.5) {
            category = 'best_half';
        } else if (41.5 <= distance && distance <= 43.0) {
            category = 'best_full';
        } else {
            return false;
        }

        // 회원 정보 가져오기
        const { data: member, error: memberError } = await supabase
            .from('rc_member')
            .select('*')
            .eq('member_id', memberId)
            .single();

        if (memberError) throw memberError;

        const currentBest = member[category];
        if (!currentBest || runningTime < currentBest) {
            // 베스트 기록 업데이트
            const updateData = {};
            updateData[category] = runningTime;

            const { error: updateError } = await supabase
                .from('rc_member')
                .update(updateData)
                .eq('member_id', memberId);

            if (updateError) throw updateError;
            return true;
        }

        return false;
    } catch (error) {
        console.error('베스트 기록 업데이트 오류:', error);
        return false;
    }
}

// 기록 삭제
async function deleteRecord(recordId) {
    if (!confirm('정말로 이 기록을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('rc_running_record')
            .delete()
            .eq('record_id', recordId);

        if (error) throw error;

        showAlert('기록이 삭제되었습니다.', 'success');
        loadRecords();
    } catch (error) {
        console.error('기록 삭제 오류:', error);
        showAlert('기록 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 모달 닫기
function closeRecordModal() {
    document.getElementById('recordModal').classList.remove('active');
    document.getElementById('recordForm').reset();
    document.getElementById('bestRecordBadge').style.display = 'none';
    currentEditId = null;
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

// 기간 필터 변경 시 날짜 입력 표시/숨김
document.getElementById('periodFilter').addEventListener('change', function() {
    const isCustom = this.value === 'custom';
    document.getElementById('startDate').style.display = isCustom ? 'inline-block' : 'none';
    document.getElementById('endDate').style.display = isCustom ? 'inline-block' : 'none';
});

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    loadMembersForDropdown();
    loadRecords();
});


