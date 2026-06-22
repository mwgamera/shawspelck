/* ---
| CONSTRUCTOR - args:
|	@params (obj) - object of constructor params
--- */

'use strict';

var Spellcheckr = function(params) { $(function() {

	//transfer constructor params to instance
	for (var param in params) this[param] = params[param];

	//checks
	if (!this.field || !$(this.field).length)
		return console.error('Spellcheckr - no field found; @field param missing or does not point to element in DOM', this.field);
	else
		this.field = $(this.field);
	if (typeof this.dictionaries != 'object')
		return console.error('Specllcheckr - no dictionaries specified to @dictionaries');

	//log some grammatical words that there's no point checking, to boost performance
	this.grammatical_words = ['𐑝', '𐑦𐑯', '𐑞', '𐑩', '𐑩𐑯', '𐑣𐑰', '𐑖𐑰', '𐑣𐑦𐑥', '𐑣𐑻', '𐑞𐑱', '𐑢𐑰', '𐑨𐑑', '𐑳𐑯𐑛𐑼', '𐑴𐑝𐑼', '𐑪𐑓', '𐑪𐑯', '𐑢𐑦𐑞', '𐑓', '𐑞𐑺', '𐑞𐑦𐑕', '𐑞𐑨𐑑', '𐑞𐑴𐑟', '𐑞𐑰𐑟', '𐑳𐑐', '𐑛𐑬𐑯', '𐑣𐑵', '𐑢𐑪𐑑', '𐑢𐑧𐑯', '𐑢𐑺', '𐑢𐑲', '𐑢𐑲𐑤', '𐑯', '𐑑', '𐑦𐑑', '𐑦𐑟', '𐑢𐑪𐑟', '𐑲', '𐑿', '𐑚𐑰', '𐑚𐑲', '𐑸', '𐑣𐑨𐑝', '𐑯𐑪𐑑', '𐑚𐑳𐑑', '𐑣𐑨𐑛', '𐑣𐑦𐑟'];

	//try to ensure no native spellchecker or similar functionality coming from browser
	['autocomplete', 'autocorrect', 'autocapitalize', 'spellcheck'].forEach(function(attr) {
		this.field.attr(attr, attr != 'spellcheck' ? 'off' : 'false');
	}.bind(this));

	//some bits
	var err_tmplt = 'Spellcheckr - invalid value for param @{param}';
	this.mode = this.mode || 'ui';
	if (['ui', 'contextual', 'both'].indexOf(this.mode) == -1) return console.error(err_tmplt.replace('{param}', 'mode'));
	this.ui_display = this.ui_display || 'popup';
	if (['dialog', 'inline'].indexOf(this.ui_display) == -1) return console.error(err_tmplt.replace('{param}', 'ui_display'));
	this.ls_key = 'spellcheckr_dic_'+this.lang;
	this.change_or_ignore_all = [];
	this.specify_other = {};
	this.allow_other = typeof this.allow_other == 'undefined' || !!this.allow_other;
	this.allow_storage = typeof this.allow_storage == 'undefined' || !!this.allow_storage;
	this.allow_add_word = typeof this.allow_add_word == 'undefined' || !!this.allow_add_word;
	this.bad_words_to_suggestions_map = {};

	//set labels (may be incoming if non-English usage)
	this.labels = $.extend({
		start: 'Spellcheck',
		intro: 'Unrecognised,',
		replace_with: 'Replace with...',
		change: 'Change',
		change_all: 'Change all',
		ignore: 'Ignore',
		ignore_all: 'Ignore all',
		add: 'Add to My Words',
		restart: 'Restart',
		specify: '...other (specify)',
		no_suggestions: '(no suggestions)',
	}, this.labels || {});

	//establish default lang, and that it corresponds to a passed dictionary
	if (!this.lang) this.lang = Object.keys(this.dictionaries)[0];
	if (!this.dictionaries[this.lang])
		return console.error('Spellcheckr - no dictionary specified in @dictioanries for default language "'+this.lang+'"');

	//build DOM
	this.dom();

	//listen for Spellcheckr
	this.Spellcheckr();

}.bind(this)); };

/* ---
| DOM - DOM stuff inc. build UI
--- */

Spellcheckr.prototype.dom = function() {

	//wrap field in container
	this.field.wrap('<div class="spellcheckr-wrapper"></div>');
	this.wrapper = this.field.parent();
	if (this.mode != 'contextual') this.wrapper.attr('data-ui-mode', 1);
	if (this.mode != 'ui') this.wrapper.attr('data-contextual-mode', 1);
	if (this.ui_display == 'dialog') this.wrapper.attr('data-ui-dialog', 1);

	//build lightbox, if UI mode and should display as dialog, not inline
	if (this.mode != 'contextual' && this.ui_display == 'dialog') {
		this.dialog_lb = $('<div />').addClass('spellcheckr-lb').prependTo(this.wrapper);
	}

	//build UI, if UI mode
	var ui_html = `
		<br>
		<aside class=spellcheckr-tools>
			<p class=row1>
				<a class=do>${this.labels.start}</a>
				<select class=lang>${(() => { let ret = ''; for (var lang_code in this.dictionaries) ret += '<option value="'+lang_code+'">'+lang_code.toUpperCase()+'</option>'; return ret; })()}
				</select>
				${(!this.dialog_lb ? `
				<span class=active-problem></span>` : '')}
				<a class=close>&times;</a>
				<a class=restart>${this.labels.restart}</a>
			</p>
			${(!this.dialog_lb ? '' : `
			<p class=row1b active-problem></p>`)}
			<p class=row2>
				<select${(!this.dialog_lb ? '' : ` multiple`)} class=suggestions>
					<option value=''>${this.labels.replace_with}</option>
					<option value=''>--------------</option>
					${(this.allow_other ? `<option value=''>${this.labels.specify}</option>` : '')}
				</select>
				${(this.allow_other ? `
				<input type=text placeholder="${this.labels.specify}" />` : '')}${(!this.dialog_lb ? '' : `
				</p><p class=dialog-tools-column>`)}
				<a class=change>${this.labels.change}</a>
				<a class=change-all>${this.labels.change_all}</a>
				<a class=ignore>${this.labels.ignore}</a>
				<a class=ignore-all>${this.labels.ignore_all}</a>
				${(this.allow_add_word ? `
				<a class=add-to-dic>${this.labels.add}</a>` : '')}
			</p>
		</aside>`;
	this.field.after(ui_html);
	this.ui = this.field.siblings('.spellcheckr-tools');

	//build field overlay
	this.overlay = $('<div />').addClass('spellcheckr-overlay').css({
		width: this.field.css('width'),
		height: this.field.css('height'),
		paddingTop: this.field.css('padding-top'),
		boxSizing: this.field.css('border-box'),
		paddingRight: this.field.css('padding-right'),
		paddingBottom: this.field.css('padding-bottom'),
		paddingLeft: this.field.css('padding-left'),
		fontFamily: this.field.css('font-family'),
		fontSize: this.field.css('font-size'),
		lineHeight: this.field.css('line-height'),
		color: this.field.css('color'),
		background: this.field.css('background-color'),
		borderWidth: this.field.css('border-left-width'),
		borderStyle: this.field.css('border-left-style'),
		borderColor: this.field.css('border-left-color'),
		marginTop: this.field.css('margin-top'),
		marginRight: this.field.css('margin-right'),
		marginBottom: this.field.css('margin-bottom'),
		marginLeft: this.field.css('margin-left'),
		whiteSpace: this.field.css('white-space')
	}).insertAfter(this.field);

	try {
		new ResizeObserver(ent => {
			this.overlay.css({
				width: this.field.css('width'),
				height: this.field.css('height'),
			});
		}).observe(this.field.get(0));
	} catch (e) { console.error(e) }

	//hide field background and text so overlay shows through
	this.field[0].style.color = this.field[0].style.background = 'transparent';

	//if contextual mode, build context menu that shows when right-clicking on problem word
	if (this.mode != 'ui') {
		this.cm_template = `
		<li class=no-click>
			<strong>{word}</strong>
		</li>
		<li data-action=ignore>${this.labels.ignore}</li>
		<li data-action=ignore-all>${this.labels.ignore_all}</li>
		<li data-action=add-to-dic>${this.labels.add}</li>
		<li class=no-click>${this.labels.replace_with}</li>
		{suggestions}
		<li class=indent data-action=specify>${this.labels.specify}</li>`;
		this.spellcheckr_cm = $('<ul />').addClass('spellcheckr-cm').appendTo(this.wrapper);
		$('body').on('click focus', function(evt) { if (!$(evt.target).closest('.spellcheckr-cm').length) this.spellcheckr_cm.fadeOut(); }.bind(this));
	}

	//commit words to overlay (as spans) as input value changes. If dialog mode, also log the containing sentence, to show that (see ::feedback())
	this.field.on('input', function() {
		var html = this.field.val()
			.replace(/([\w\p{Letter}\u2E30\u2060\uFE00'-]+)/uig, '<span>$1</span>')
			.replace(/([\?\.!])/ug, '<span class="end-of-sntnc-sign">$1</span>');
		this.overlay.html(html);
	}.bind(this)).trigger('input');

	//if contextual mode, do spellcheck constantly, on input to field (else if UI mode, only when spellcheck
	//button clicked)
	if (this.mode != 'ui') {
		var to;
		this.field.on('input', function() {
			clearTimeout(to);
			to = setTimeout(function() { this.do_spellcheck(null, 1); }.bind(this), 200);
		}.bind(this)).trigger('input');
	}

	//on textarea scroll, scroll overlay
	this.field.on('scroll input', this.onScrollCallback = () =>
		this.overlay[0].scrollTop = this.field[0].scrollTop
	);

	//listen for toggle "specify other" field
	this.ui.on('change', '.suggestions', function() {
		var input = $(this).next()
		input[$(this).children(':selected').is(':last-child') ? 'show' : 'hide']();
		$(this).trigger('blur').next()[0].focus();
	});

	//listen for close
	this.ui.on('click', '.close', function() { this.wrapper.removeClass('active'); }.bind(this));

	//on blur to UI, always go back to field - that way we retain any highlighting on bad words
	this.ui.on('blur', '*', function() { this.field[0].focus(); }.bind(this));

	//listen for change/change all actions
	this.ui.on('click', '.change, .change-all', function(evt) {
		if (this.get_repl()) {
			this.curr_bad_word_el.text(this.get_repl()).removeClass('problem');
			if ($(evt.target).is('.change-all')) {
				this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this)).text(this.get_repl()).removeClass('problem');
				this.change_or_ignore_all.push(!this.case_sensitive ? this.curr_bad_word.toLowerCase() : this.curr_bad_word);;
			}
			this.curr_bad_word_index++;
			this.field.val(this.overlay.text());
			this.feedback();
		}
	}.bind(this));

	//listen for ignore actions
	this.ui.on('click', '.ignore, .ignore-all', function(evt, is_from_contextual) {
		this.curr_bad_word_el.removeClass('problem');
		if (evt && $(evt.target).is('.ignore-all') || is_from_contextual == 'all') {
			this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this)).removeClass('problem');
			this.change_or_ignore_all.push(!this.case_sensitive ? this.curr_bad_word.toLowerCase() : this.curr_bad_word);;
		} else
			this.curr_bad_word_el.addClass('ignore-single-instance');
		if (!is_from_contextual) {
			this.curr_bad_word_index++;
			this.feedback();
		}
	}.bind(this));

	//listen for 'add to my words' actions
	this.ui.on('click', '.add-to-dic', function(evt, is_from_contextual) {
		this.curr_bad_word_el.add(this.curr_bad_word_el.siblings().filter(function(i, el) { return $(el).text() == this.curr_bad_word; }.bind(this))).removeClass('problem');
		var my_words = localStorage[this.ls_key+'_my_words'] || {};
		if (typeof my_words != 'object') my_words = JSON.parse(my_words);
		my_words[this.curr_bad_word.toLowerCase()] = this.dictionary[this.curr_bad_word.toLowerCase()] = 1;
		if (!is_from_contextual) this.ui.find('.ignore').trigger('click');
		localStorage[this.ls_key+'_my_words'] = JSON.stringify(my_words);
	}.bind(this));

	//listen for switch language...
	this.ui.find('.lang').on('change', function(evt, onload_auto_select) {
		if (onload_auto_select) $(evt.target).val(onload_auto_select);
		console.log('Spellcheckr - switched language to '+$(evt.target).val().toUpperCase());
		delete this.dictionary;
		this.lang = $(evt.target).val();
		this.ls_key = 'spellcheckr_dic_'+this.lang;

		//...//if switched mid-spellcheck, restart with new language
		if (this.wrapper.is('.active')) this.do_spellcheck();

		//...if contextual mode, reassess contextual problems
		this.field.trigger('input');

	}.bind(this)).trigger('change', this.lang);

	//if contextual mode, listen for right-clicks on bad words. Find corresponding word span in overlay by comparing mouse/span coordinates...
	this.field.on('contextmenu', function(evt) {
		var mouse_x = evt.pageX - this.field.offset().left, mouse_y = evt.pageY - this.field.offset().top;
		this.overlay.find('.problem').each(function(i, el) {
			var os = $(el).position();
			if (os.left < mouse_x && os.top - mouse_y && os.left + $(el).width() > mouse_x && os.top + $(el).height() > mouse_y) {
				evt.preventDefault();
				var cm_html = this.cm_template.replace('{word}', $(el).text()).replace('{suggestions}', (function() {
					var ret = '',
					word = $(el).text().toLowerCase(),
					suggestions = this.get_suggestions(word);
					for (var suggestion in suggestions) ret += '<li class="indent" data-action="replace">'+suggestion+'</li>';
					return ret;
				}).call(this));
				this.spellcheckr_cm.css({left: mouse_x, top: mouse_y}).html(cm_html).fadeIn();
				this.curr_bad_word = $(el).text();
				this.curr_bad_word_el = $(el);
				return false;
			}
		}.bind(this));
	}.bind(this));

	//...and for context menu choices
	if (this.spellcheckr_cm) this.spellcheckr_cm.on('click', 'li[data-action]', function(evt) {
		switch ($(evt.target).data('action')) {
			case 'ignore': this.ui.find('.ignore').trigger('click', 1); break;
			case 'ignore-all': this.ui.find('.ignore').trigger('click', 'all'); break;
			case 'add-to-dic': this.ui.find('.add-to-dic').trigger('click', 1); break;
			case 'specify': this.curr_bad_word_el.text(prompt('Enter a replacement', this.curr_bad_word) || this.curr_bad_word); break;
			case 'replace': this.curr_bad_word_el.text($(evt.target).text()).removeClass('problem'); break;
		}
		console.log(this.spellcheckr_cm.data('suggestions'));
		this.field.val(this.overlay.text());
		this.spellcheckr_cm.hide();
	}.bind(this));

	//prevent submit until errors resolved?
	if (this.prevent_submit) this.field.closest('form').on('submit', function(evt) {
		if ((this.mode != 'ui' && this.overlay.find('.problem').length)) {
			evt.preventDefault();
			alert('Please fix spelling errors before continuing');
		}
	}.bind(this));

};

/* ---
| LOAD DICTIONARY - and parse it into object. May already be in localStorage. Also log the letters of the language's alphabet while here (from the unique
| first letters in the dictionary.) Args:
|	@flush (bool) - if localStorage copy is ruined in any way (i.e. can't be parsed as JSON), attempts fresh load of file
--- */

Spellcheckr.prototype.load_dic = function(flush) {
	if (this.dictionary) return true;
	this.alphabet_letters = {};
	this.dic_dfd = new $.Deferred;

	//load from file
	if (!localStorage[this.ls_key] || flush || !this.allow_storage) {
		var no_cache_suffix = location.search.indexOf('spellcheck_flush=1') == -1 ? '' : '?r='+Math.random();
		$.get(this.dictionaries[this.lang]+no_cache_suffix)
			.done(function(words) {
				if (this.allow_storage) localStorage[this.ls_key] = words.toLowerCase();
				this.parse_dic(words.toLowerCase());
			}.bind(this))
			.error(function() { console.error('Could not load Spellcheckr dictionary at '+this.dictionaries[this.lang]); }.bind(this));

	//load from local storage
	} else {
		this.parse_dic(localStorage[this.ls_key]);
		this.dic_dfd.resolve();
	}

	return this.dic_dfd;
};

Spellcheckr.prototype.parse_dic = function(words) {
	var my_words = localStorage[this.ls_key+'_my_words'] || {};
	if (typeof my_words != 'object') my_words = JSON.parse(my_words);
	this.dictionary = words.split('|').reduce(function(prev, curr) {
		prev[curr] = 1;
		let letter = curr.match(/^./u)?.[0]
		this.alphabet_letters[letter] = 1;
		return prev;
	}.bind(this), {});
	this.dictionary = $.extend(this.dictionary, my_words);
	this.dictionary;
	this.dic_dfd.resolve();
}

/* ---
| SPELLCHECK - main func for doing spellcheck. Runs in two modes - UI and contextual. Former calls func only when spellcheck button manually clicked;
| latter calls func contstantly, on input to field. In case of former, highlight one bad word at a time and show feedback UI; in case of latter, highlight
| all bad words (that's it).
--- */

Spellcheckr.prototype.Spellcheckr = function() {
	this.ui.on('click', '.do, .restart', this.do_spellcheck = function(evt, is_from_contextual) { $.when(this.load_dic()).then(function() {

		//prep
		if (evt) evt.preventDefault();
		this.curr_bad_word_index = 0;

		//gather up words
		var words = this.overlay.children('span:not(.end-of-sntnc-sign)');
		this.problem_words = [];

		//evaluate each...
		words.each(function(i, el) {
			var word = $(el).text().toLowerCase();
			if (
				!this.dictionary[word] &&
				this.grammatical_words.indexOf(word) == -1 &&
				this.change_or_ignore_all.indexOf(!this.case_sensitive ? word.toLowerCase() : word) == -1 &&
				!$(el).is('.ignore-single-instance')
			)

				//..if problematic, log it for feedback. If dialog mode, also log word's surrounding prev and remaining parts of sentence, if any
				this.problem_words.push({
					word: $(el).text(),
					el: $(el).addClass('problem'),
					surrounding_sentence_parts: !this.dialog_lb ? null : (function() {
						var
						prev_part_of_sntnc = $.map($(el).prevUntil('.end-of-sntnc-sign'), function(el) { return $(el).text(); }),
						next_els_in_sntnc = $(el).nextUntil('.end-of-sntnc-sign'),
						is_final_word_of_sntnc = $(el).next().is('.end-of-sntnc-sign'),
						remainder_of_sntnc = !is_final_word_of_sntnc ? $.map(next_els_in_sntnc, function(el) { return $(el).text(); }) : [];
						prev_part_of_sntnc.reverse();
						return [
							prev_part_of_sntnc.join(' '),
							remainder_of_sntnc.join(' ')+(!is_final_word_of_sntnc ? next_els_in_sntnc.last().next().text() : $(el).next().text())
						];
					})(),
					suggestions: Object.keys(this.get_suggestions(word))
				});
		}.bind(this));

		//if contexutal mode and request came from input, not click to spellcheck button, highlight all bad words - otherwise, continue to feedback
		if (is_from_contextual) return;

		//begin feedback if problems found else notify all OK
		console.log('Spellcheckr - result', this.problem_words);
		this.problem_words.length ? this.feedback() : alert('✅ 𐑯𐑴 𐑕𐑐𐑧𐑤𐑦𐑙 𐑧𐑮𐑩𐑮𐑟 𐑓𐑬𐑯𐑛! 💯');

	}.bind(this)); }.bind(this));
};

/* ---
| GET SUGGESTIONS - if a word isn't found, we're sent here to get suggestions for what it might have been. Returns array of suggestions. Args:
|	@lookup (str)	- the word to look up
--- */

Spellcheckr.prototype.get_suggestions = function(lookup) {

	let suggestions = {},
		word,
		word2;

	//already cached this word's suggestions?
	if (this.bad_words_to_suggestions_map[lookup]) return this.bad_words_to_suggestions_map[lookup];

	// 0: Shavian-specific, don't try others if these succeed
	for (let w of (function*(w){
		let common = {"𐑞𐑩":["𐑞","𐑞𐑺"],"𐑞𐑦":["𐑞"],"𐑷𐑝":["𐑝"],"𐑪𐑝":["𐑝"],"𐑩𐑝":["𐑝","𐑣𐑨𐑝"],"𐑨𐑯𐑛":["𐑯"],"𐑩𐑯𐑛":["𐑯"],"𐑯𐑛":["𐑯"],"𐑱":["𐑩"],"𐑑𐑩":["𐑑"],"𐑦":["𐑦𐑑","𐑲"],"𐑢𐑩𐑟":["𐑢𐑪𐑟"],"𐑓𐑩":["𐑓"],"𐑓𐑼":["𐑓"],"𐑘𐑩":["𐑿","𐑘𐑹","𐑘𐑧𐑩"],"𐑘𐑫":["𐑿"],"𐑣𐑦":["𐑣𐑰"],"𐑖𐑦":["𐑖𐑰"],"𐑚𐑦":["𐑚𐑰"],"𐑞𐑩𐑑":["𐑞𐑨𐑑"],"𐑞𐑑":["𐑞𐑨𐑑"],"𐑩𐑑":["𐑨𐑑"],"𐑚𐑩𐑑":["𐑚𐑳𐑑"],"𐑓𐑮𐑩𐑥":["𐑓𐑮𐑪𐑥"],"𐑓𐑮𐑳𐑥":["𐑓𐑮𐑪𐑥"],"𐑓𐑮𐑭𐑥":["𐑓𐑮𐑪𐑥"],"𐑣𐑩𐑛":["𐑣𐑨𐑛"],"𐑩𐑛":["𐑣𐑨𐑛","𐑢𐑫𐑛"],"𐑢𐑦":["𐑢𐑰"],"𐑨𐑯":["𐑩𐑯"],"𐑧𐑯":["𐑩𐑯"],"𐑢𐑼":["𐑢𐑻"],"𐑢𐑩":["𐑢𐑻"],"𐑣𐑩𐑝":["𐑣𐑨𐑝"],"𐑣𐑩𐑟":["𐑣𐑨𐑟"],"𐑩𐑟":["𐑨𐑟","𐑣𐑨𐑟"],"𐑢𐑩𐑛":["𐑢𐑫𐑛"],"𐑢𐑩𐑑":["𐑢𐑪𐑑"],"𐑢𐑳𐑑":["𐑢𐑪𐑑"],"𐑣𐑢𐑪𐑑":["𐑢𐑪𐑑"],"𐑣𐑢𐑳𐑑":["𐑢𐑪𐑑"],"𐑞𐑼":["𐑞𐑺"],"𐑒𐑩𐑯":["𐑒𐑨𐑯"],"𐑒𐑧𐑯":["𐑒𐑨𐑯"],"𐑣𐑼":["𐑣𐑻"],"𐑼":["𐑣𐑻"],"𐑻":["𐑣𐑻"],"𐑞𐑩𐑥":["𐑞𐑧𐑥"],"𐑩𐑥":["𐑨𐑥","𐑞𐑧𐑥"],"𐑕𐑩𐑥":["𐑕𐑳𐑥"],"𐑒𐑩𐑛":["𐑒𐑫𐑛"],"𐑑𐑫":["𐑑","𐑑𐑵"],"𐑦𐑯𐑑𐑫":["𐑦𐑯𐑑𐑵"],"𐑦𐑯𐑑𐑩":["𐑦𐑯𐑑𐑵"],"𐑘𐑼":["𐑘𐑹","𐑘𐑧𐑩"],"𐑘𐑻":["𐑘𐑹"],"𐑘𐑫𐑼":["𐑘𐑹"],"𐑥𐑦":["𐑥𐑰"],"𐑖𐑩𐑛":["𐑖𐑫𐑛"],"𐑞𐑩𐑯":["𐑞𐑨𐑯"],"𐑥𐑩𐑕𐑑":["𐑥𐑳𐑕𐑑"],"𐑥𐑩𐑕":["𐑥𐑳𐑕𐑑"],"𐑛𐑩𐑟":["𐑛𐑳𐑟"],"𐑩𐑕":["𐑳𐑕"],"𐑕":["𐑳𐑕"],"𐑥":["𐑨𐑥"],"𐑖𐑩𐑤":["𐑖𐑨𐑤"],"𐑟":["𐑦𐑟"],"𐑚":["𐑚𐑰"],"𐑢":["𐑢𐑦𐑞"],"𐑣":["𐑣𐑰"],"𐑮":["𐑸"],"𐑛":["𐑛𐑵"],"𐑢𐑟":["𐑢𐑪𐑟"],"𐑣𐑝":["𐑣𐑨𐑝"],"𐑯𐑑":["𐑯𐑪𐑑"],"𐑞𐑕":["𐑞𐑦𐑕"],"𐑚𐑑":["𐑚𐑳𐑑"],"𐑓𐑥":["𐑓𐑮𐑪𐑥"],"𐑣𐑛":["𐑣𐑨𐑛"],"𐑣𐑟":["𐑣𐑨𐑟"],"𐑚𐑯":["𐑚𐑰𐑯","𐑚𐑦𐑯"],"𐑢𐑮":["𐑢𐑻"],"𐑢𐑛":["𐑢𐑫𐑛"],"𐑢𐑑":["𐑢𐑪𐑑"],"𐑒𐑯":["𐑒𐑨𐑯"],"𐑞𐑥":["𐑞𐑧𐑥"],"𐑕𐑥":["𐑕𐑳𐑥"],"𐑒𐑛":["𐑒𐑫𐑛"],"𐑖𐑛":["𐑖𐑫𐑛"],"𐑞𐑯":["𐑞𐑧𐑯","𐑞𐑨𐑯"],"𐑛𐑟":["𐑛𐑳𐑟"],"𐑖𐑤":["𐑖𐑨𐑤"]};
		for (let c of common[w]||[])
			yield c;
		yield w=w.replace(/\u2060/ug, '');
		yield w=w.replace(/^⸰/ug, '⸰\u2060');
		yield w=w.replace(/𐑾𐑮/ug, '𐑽');
		yield w=w.replace(/𐑘𐑵/ug, '𐑿');
		yield w=w.replace(/𐑭𐑮/ug, '𐑸');
		yield w=w.replace(/𐑷𐑮/ug, '𐑹');
		yield w=w.replace(/𐑩𐑮/ug, '𐑼');
		yield w.replace(/𐑽$/u, '𐑦𐑼'); // AJC
		yield w.replace(/𐑼/u, '𐑩𐑮'); // 𐑦𐑯𐑓𐑮𐑩𐑮𐑧𐑛
		yield w=w.replace(/^𐑢𐑣/u, '𐑢');
		yield w=w.replace(/^𐑢𐑮/u, '𐑮');
		yield w=w.replace(/𐑻𐑮/ug, '𐑻');
		yield w=w.replace(/𐑰𐑙/ug, '𐑦𐑙');
		yield w=w.replace(/𐑱𐑙/ug, '𐑨𐑙');
		yield w=w.replace(/𐑖𐑗𐑮/ug, '𐑕𐑑𐑮');
		yield w.replace(/𐑗𐑮/ug, '𐑑𐑮');
		yield w.replace(/𐑡𐑮/ug, '𐑛𐑮');
		yield w.replace(/𐑰$|𐑰(?=[𐑦𐑰𐑧𐑱𐑨𐑲𐑩𐑼𐑳𐑪𐑴𐑫𐑵𐑬𐑶𐑭𐑸𐑷𐑹𐑺𐑻𐑾𐑽])/ug, '𐑦');
		yield w.replace(/(?<=^.)𐑦$/u, '𐑰');
		yield w.replace(/𐑼𐑮/ug, '𐑻');
		yield w.replace(/𐑴𐑮/ug, '𐑹');
		yield w.replace(/𐑰𐑼/ug, '𐑽');
		yield w.replace(/𐑰𐑩/ug, '𐑾');
		yield w.replace(/𐑦𐑘/ug, '𐑰');
		yield w.replace(/𐑧𐑘/ug, '𐑱');
		yield w.replace(/𐑨𐑘/ug, '𐑲');
		yield w.replace(/𐑪𐑘/ug, '𐑶');
		yield w.replace(/𐑰𐑘/ug, '𐑰');
		yield w.replace(/𐑭𐑘/ug, '𐑲');
		yield w.replace(/𐑷𐑘/ug, '𐑶');
		yield w.replace(/𐑨𐑢/ug, '𐑬');
		yield w.replace(/𐑫𐑢/ug, '𐑵');
		yield w.replace(/𐑩𐑢/ug, '𐑴');
		yield w.replace(/𐑩𐑢/ug, '𐑵');
		yield w.replace(/𐑩𐑢/ug, '𐑫');
		yield w.replace(/𐑭𐑢/ug, '𐑬');
		yield w.replace(/𐑵𐑢/ug, '𐑵');
		yield w.replace(/𐑪𐑢/ug, '𐑷𐑤');
		yield w.replace(/𐑷𐑢/ug, '𐑷𐑤');
	})(lookup)) {
		if (!this.dictionary[w]) continue;
		suggestions[w] = 1;
	}
	if (Object.keys(suggestions).length) {
		this.bad_words_to_suggestions_map[lookup] = suggestions;
		return suggestions;
	}

	//...method 1: iteratively shave off a letter - this handles words misspelt through an added latter e.g. rabbitr => rabbit, rabbi
	let word_arr = lookup.split(/(?=.)/u),
		curLetters = word_arr.slice( 0 );
	while (curLetters.length > 2) {
		if (this.dictionary[curLetters.join('')]) suggestions[curLetters.join('')] = 1;
		curLetters.pop();
	}

	//...method 2: check for extraneous letters within the word. Iteratively remove each letter and look up, e.g. rabybit => rabbit
	for (var g=0; g<word_arr.length; g++) {
		word = word_arr.slice(0, g).concat(word_arr.slice(g+1)).join('');
		if (this.dictionary[word]) suggestions[word] = 1;
	}

	//...method 3: check for missing or errneous letters. Iteratively add/replace a letter (try each of the alphabet's letters) at each position,
	//e.g. rabit => rabbit and rabyit => rabbit
	for (var g=0; g<word_arr.length; g++)
		for (var letter in this.alphabet_letters) {
			word = word_arr.slice(0, g).concat(letter).concat(word_arr.slice(g)).join('');
			word2 = word_arr.slice(0, g).concat(letter).concat(word_arr.slice(g+1)).join('');
			if (this.dictionary[word]) suggestions[word] = 1;
			if (this.dictionary[word2]) suggestions[word2] = 1;
		}

	//...method 4: check for neighbouring words the wrong way round, e.g. rabbti => rabbit
	for (var g=0; g<lookup.length-1; g++) {
		word = word_arr.slice(0, g).concat(word_arr.slice(g,g+2).reverse()).concat(word_arr.slice(g+2)).join('');
		if (this.dictionary[word]) suggestions[word] = 1;
	}

	this.bad_words_to_suggestions_map[lookup] = suggestions;
	return suggestions;

};

/* ---
| FEEDBACK - show feedback re: the next bad word to be dealt with.
--- */

Spellcheckr.prototype.feedback = function() {

	var obj = this.problem_words[this.curr_bad_word_index];
	if (obj && this.change_or_ignore_all.indexOf(!this.case_sensitive ? obj.word.toLowerCase() : obj.word) != -1) {
		this.curr_bad_word_index++;
		return this.feedback();
	}

	//done?
	if (!obj) {
		this.wrapper.removeClass('active');
		alert('Spellcheck complete.');
		//this.field[0].selectionStart = this.field[0].selectionEnd = 0;
		return;
	}

	//establish text to demonstrate problem - depends on whether inline (intro + word) or dialog mode (sentence containing problem, with problem highlighted)
	var problem_demo_text = !this.dialog_lb ?
		this.labels.intro+' <strong>"'+obj.word+'"</strong>' :
		(obj.surrounding_sentence_parts[0]+' <span class="problem">'+obj.word+'</span> '+obj.surrounding_sentence_parts[1]).replace(/ (?=[\?\.!])/, '');

	//populate/set up UI...
	this.curr_bad_word = obj.word;
	this.curr_bad_word_el = obj.el.addClass('curr-bad-word');
	obj.el.siblings().removeClass('curr-bad-word');
	this.ui.find('input').val('');
	this.wrapper.addClass('active');
	this.ui.find('.active-problem').html(problem_demo_text);
	var dd = this.ui.find('.suggestions');
	dd.children(':first').prop('selected', 1).trigger('change');
	dd.children(':not([value=""])').remove();
	var ins_after = dd.children(':nth-child(2)');

	//...build suggestion options - include any custom replacements for this word seen previously
	if (this.specify_other[this.curr_bad_word]) this.specify_other[this.curr_bad_word].forEach(function(prev_choice) { obj.suggestions.push(prev_choice); });
	for (var k=0; k<obj.suggestions.length; k++) $('<option />', {text: obj.suggestions[k]}).insertAfter(ins_after);
	if (!dd.children(':not([value=""])').length) $('<option />', {text: '(no suggestions)', value: ''}).insertAfter(ins_after);
	dd.children(':first').prop('selected', 1);

};

/* ---
| REPLACEMENT - get replacement preference
--- */

Spellcheckr.prototype.get_repl = function() {

	//establish replacement choice
	var input = this.ui.find('input:visible'), ret = input.val() || this.ui.find('.suggestions').val();
	if (!ret) alert('Spellcheck - you must choose a replacement option');

	//if specified custom choice, remember it so if we meet this word again later (and change-all not chosen), we can suggest same choice
	if (input.length) {
		if (!this.specify_other[this.curr_bad_word]) this.specify_other[this.curr_bad_word] = [];
		if (this.specify_other[this.curr_bad_word].indexOf(input.val()) == -1) this.specify_other[this.curr_bad_word].push(input.val());
		console.log(this.specify_other);
	}

	this.field[0].focus();
	return ret;

}
