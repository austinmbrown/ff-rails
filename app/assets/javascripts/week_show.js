window.addEventListener('load', function () {
  var Week ={
    props: ['week', 'user_id'],
    template: `
      <div class="week">
        <start-time id="start-time" :start_time="start_time" v-for="start_time in week" v-bind:key="start_time.id" :user_id="user_id" ></start-time>
      </div>`
  };

  Vue.component('start-time', {
    props: ['start_time', 'user_id'],
    template: `
      <div class="start-time">
        <div class="start-time__text start-time__text--gametime">{{ formatGameTime(start_time.gameTime) }}</div>
        <game-details id="game" :game="game" v-for="game in start_time.games" v-bind:key="game.id" :hasBegun="determinePickability(start_time.gameTime)" :user_id="user_id" ></game-details>
      </div>`,
    methods: {
      formatGameTime: function (_gameTime) {
        return moment(_gameTime).format("[WK] ddd - hh:mmA");
      },
      determinePickability: function (_gameTime) {
        return moment().diff(_gameTime, 'minutes') < 0;
      }
    }
  });

  Vue.component('game-details', {
    props: ['game', 'hasBegun', 'user_id'],
    template: `
      <div class="game" v-bind:class="[hasBegun ? 'game--is-pickable' : 'game--is-frozen']">
        <team-details id="team" :pick="pick" :team="awayTeam" :isHome="false" :isDisabled="!hasBegun" :user_id="user_id" ></team-details>
        <team-details id="team" :pick="pick" :team="homeTeam" :isHome="true" :isDisabled="!hasBegun" :user_id="user_id" ></team-details>
      </div>`,
    data: function() {
      return {
        pick: {},
        awayTeam: {},
        homeTeam: {}
      }
    },
    created: function() {
      let self = this;
      $.ajax({
        method: "GET",
        url: "/teams/" + self.game.away_team_id + ".json",
        success: (team_data => {self.awayTeam = team_data}),
        error: (error => {console.log(error)})
      })
      $.ajax({
        method: "GET",
        url: "/teams/" + self.game.home_team_id + ".json",
        success: (team_data => {self.homeTeam = team_data}),
        error: (error => {console.log(error)})
      })
      find_pick_url = '/picks/find?game_id=' + self.game.id
      $.ajax({
        method: "GET",
        url: find_pick_url,
        success: (pick_data => {self.pick = pick_data}),
        error: (error => {console.log(error)})
      })
    },
    methods: {  }
  });

  Vue.component('team-details', {
    props: ['team', 'isHome', 'isDisabled', 'user_id', 'pick'],
    template: `
      <!-- Have Vue tell Rails to create a pick if there is no pick -->
      <!-- And maybe modify the pick if there is an existing pick -->
      <!-- ALSO making a selection, doesn't dynamically refresh the pick data that's being passed through -->
      <button class="team" v-on:click="createPick(user_id)" v-bind:disabled="isDisabled" v-bind:class="[[isHome ? 'team--home' : 'team--away'],{'team--picked' : isPicked}]">
        <div class="team__logo">
          <img src=""/>
        </div>
        <div class="team__text-container" v-bind:class="[isHome ? 'team__text-container--home' : 'team__text-container--away']">
          <div class="team__text team__text--name">{{ team.name }}</div>
          <div class="team__text team__text--record">{{ team.wins }} - {{ team.losses }}</div>
        </div>
      </button>`,
    mounted: function () {
      let self = this
    },
    computed: {
      isPicked: function() {
        let self = this
        if(self.pick && self.team)
          return self.pick.picked_team_id === self.team.id
        else
          return false
      }
    },
    methods: {
      createPick: function (_userId, _isFavTeamPick) {
        let self = this

        gameId = self.$parent.game.id
        teamId = self.team.id
        userId = _userId
        pickUrl = '/picks' + '?game_id=' + gameId + '&picked_team_id=' + teamId
        if(_isFavTeamPick) {
          pickUrl = pickUrl + '&fav_pick=' + true
        }
        console.log(self.$parent.pick)
        if(self.$parent.pick) {
          $.ajax({
            method: "DELETE",
            url: '/picks/' + self.$parent.pick.id
          }).then((r) => self.$parent.pick = null)
        } else {
          $.ajax({
            method: "POST",
            url: pickUrl,
            success: (pick_data => {self.$parent.pick = pick_data}),
            error: (error => {console.log(error)})
          })
        }
      }
    }
  });

  const vm_weeks_show = new Vue({
    el: '#week',
    created: function () {
      currentSearch = location.search;

      getCurrentlyViewedWeek = function() {
        weekNumber = parseInt(currentSearch.replace(/[^0-9\.]/g, ''), 10);
        if (isNaN(weekNumber)) {
          today = Date.now();
          firstDay = Date.parse('Aug 22, 2017');
          lastDay = Date.parse('Feb 22, 2018');

          if (today < firstDay || today > lastDay) {
            return
          } else {
            weekNumber = moment(today).startOf('week').diff(firstDay, 'weeks') - 1;
          }
        }
        return weekNumber;
      };

      thisWeek = getCurrentlyViewedWeek();

      let self = this;
      let weekUrl = "/weeks/" + thisWeek + ".json";

      $.ajax({
        method: "GET",
        url: weekUrl,
        success: (week_data => {self.week = week_data}),
        error: (error => {console.log(error)})
      })
    },
    components: {
      'week' : Week
    },
    data: function() {
      return { week: [], teams: [] }
    },
    methods: {
      groupGamesByKickoff: function(_gamesArray) {

        let makeKickoffObject = function (_id, _time) {
          newKickoffObject = {};
          newKickoffObject.id = _id;
          newKickoffObject.gameTime = _time;
          newKickoffObject.games = [];
          return newKickoffObject
        }

        let week = [];
        let kickoff = makeKickoffObject(1, "To be overwritten");

        for (n = 0; n < _gamesArray.length; n++) {
          let thisGame = _gamesArray[n];
          if (thisGame.kickoff === kickoff.gameTime) {
            kickoff.games.push(thisGame);
          } else {
            if (kickoff.games.length > 0) { week.push(kickoff); }

            kickoff = makeKickoffObject(kickoff.id + 1, thisGame.kickoff);
            kickoff.games.push(thisGame);

            if (n === _gamesArray.length - 1) { week.push(kickoff); }
          }
        }
        reversedWeek = week.reverse();
        return reversedWeek;
      }
    },
    actions: {  }
  });
})
