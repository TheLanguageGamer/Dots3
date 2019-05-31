#include "Engine.h"
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

struct Trivium
{
	enum Type
	{
		Year,
		Quantity,
	};

	Type type;
	std::string link;
	std::string text;
	int64_t value;
	int32_t seen;

	Trivium(Type type, std::string link, std::string text, int64_t value)
	: type(type)
	, link(link)
	, text(text)
	, value(value)
	, seen(0) {}
};

std::vector<Trivium> getTrivia()
{
	return {
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Korean_War",
			"The year the Korean War started",
			1950),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Assassination_of_John_F._Kennedy",
			"The year JFK was assasinated",
			1963),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Assassination_of_Martin_Luther_King_Jr.",
			"The year Martin Luther King Jr. was assasinated",
			1968),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Brown_v._Board_of_Education",
			"The year of the Brown v. Board of Education Supreme Court decision",
			1954),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/The_Beatles",
			"The year The Beatles appeared on The Ed Sullivan Show",
			1964),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Women%27s_suffrage_in_the_United_States",
			"The year women got the right to vote in the United States",
			1920),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Women%27s_suffrage_in_the_United_Kingdom",
			"The year women got the right to vote in the United Kingdom",
			1918),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Women%27s_suffrage#France",
			"The year women got the right to vote in France",
			1944),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Billie_Holiday#1939:_%22Strange_Fruit%22_and_Commodore_Records",
			"The year Billie Holiday first performed Strange Fruit",
			1939),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence",
			"The year the United States declared independence from Britain",
			1939),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Independence_Day_(India)",
			"The year India gained independence from the United Kingdom",
			1947),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Independence_of_Jamaica",
			"The year Jamaica gained independence from the United Kingdom",
			1962),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Great_Depression#Start",
			"The year the Great Depression started in the United States",
			1929),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Roe_v._Wade",
			"The year of the Roe v. Wade Supreme Court decision",
			1973),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Roe_v._Wade",
			"The year Charlemagne was crowned Holy Roman Emperor",
			800),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Averroes",
			"The year the physician and philosopher Averroës is born",
			1126),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Genghis_Khan",
			"The year Temüjin is proclaimed Genghis Khan of the Mongol people",
			1206),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Marco_Polo",
			"The year Marco Polo begins his journey to China",
			1271),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Tenochtitlan",
			"The year the Aztecs found the city of Tenochtitlán",
			1325),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Ransom_of_King_John_II_of_France",
			"The year King John II of France was ransomed",
			1356),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Ming_dynasty",
			"The year the Ming dynasty started in China",
			1368),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Jan_Hus",
			"The year Jan Hus burned at the stake for heresy",
			1415),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Columbus",
			"The first voyage of Columbus",
			1492),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Columbus",
			"The Treaty of Tordesillas, dividing the New World between Spain and Portugal",
			1494),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Atlantic_slave_trade",
			"First reported African slaves in the New World",
			1494),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Ninety-five_Theses",
			"Martin Luther posts the 95 theses against the practices of the church",
			1517),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Tenochtitlan",
			"Cortes conquers Tenochtitlan (Mexico City)",
			1521),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/East_Indies",
			"The Dutch colonize the East Indies (Indonesia)",
			1595),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/New_Amsterdam",
			"The Dutch found New Amsterdam (New York)",
			1626),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/French_Revolution#Storming_of_the_Bastille",
			"The Storming of the Bastille and the beginning of the French Revolution",
			1789),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Battle_of_Hastings",
			"William the Conqueror defeats Harold at the Battle of Hastings",
			1066),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Battle_of_Hastings",
			"William the Conqueror defeats Harold at the Battle of Hastings",
			1066),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Magna_Carta#Great_Charter_of_1215",
			"The sealing of the Magna Carta, offering protection from illegal imprisonment and other rights",
			1215),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Black_Death_in_England#Death_toll",
			"The Black Death arrives in England, eventually killing four million",
			1348),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Hamlet",
			"William Shakespeare writes Hamlet",
			1602),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Gunpowder_Plot",
			"Guy Fawkes' plot to assasinate King James I is thwarted",
			1605),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Battle_of_Waterloo",
			"The Duke of Wellington defeats Napoleon at the Battle of Waterloo",
			1815),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Tim_Berners-Lee",
			"Tim Berners-Lee invents the World Wide Web",
			1989),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Muhammad",
			"Muhammad, the founder of Islam, is born",
			570),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Muhammad",
			"Muhammad, the founder of Islam, is born",
			570),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Spanish_Armada",
			"King Philip II's Spanish Armada is defeated by an English naval force",
			1588),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Suez_Canal",
			"The Suez Canal opens, connecting the Mediterranean Sea and the Red Sea",
			1869),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Soga%E2%80%93Mononobe_conflict",
			"The pro-Buddhist Soga clan defeats the pro-Shinto Mononobe clan in Japan",
			587),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/The_Tale_of_Genji",
			"The Tale of Genji, considered the first novel, is written by a Japanese woman",
			1010),
		Trivium(
			Trivium::Year,
			"https://en.wikipedia.org/wiki/Symphony_No._9_(Beethoven)",
			"Ludwig van Beethoven premieres his Symphony No. 9",
			1824),
	};
}

struct Color
{
	uint32_t red;
	uint32_t green;
	uint32_t blue;
	uint32_t alpha;
	Color()
	: red(0)
	, green(0)
	, blue(0)
	, alpha(0) {}

	uint32_t rgba()
	{
		return (red << 24) + (green << 16) + (blue << 8) + 0xFF;
	}

	static Color fromRGBA(uint32_t rgba)
	{
		Color color;
		color.red = rgba >> 24;
		color.green = (rgba >> 16) & 0xFF;
		color.blue = (rgba >> 8) & 0xFF;
		color.alpha = rgba & 0xFF;
		return color;
	}

	static Color interpolate(
		const Color& a,
		const Color& b,
		const Color& c,
		const Color& d,
		float aFraction,
		float bFraction,
		float cFraction,
		float dFraction)
	{
		Color color;
		color.red = a.red*aFraction + b.red*bFraction + c.red*cFraction + d.red*dFraction;
		color.green = a.green*aFraction + b.green*bFraction + c.green*cFraction + d.green*dFraction;
		color.blue = a.blue*aFraction + b.blue*bFraction + c.blue*cFraction + d.blue*dFraction;
		color.alpha = a.alpha*aFraction + b.alpha*bFraction + c.alpha*cFraction + d.alpha*dFraction;
		return color;
	}
};

struct LyricsLevel
{
	std::vector<std::string> lines;
};

static const std::vector<LyricsLevel> getLyricsLevels()
{
	std::vector<LyricsLevel> levels;

	LyricsLevel level1;
	level1.lines = std::vector<std::string>({
		"Hey Jude, don't make it bad",
		"Take a sad song and make it better",
		"Remember to let her into your heart",
		"Then you can start to make it better",
		"",
		"Hey Jude, don't be afraid",
		"You were made to go out and get her",
		"The minute you let her under your skin",
		"Then you begin to make it better",
		"",
		"And anytime you feel the pain, hey Jude, refrain",
		"Don't carry the world upon your shoulders",
		"For well you know that it's a fool who plays it cool",
		"By making his world a little colder",
	});
	levels.push_back(level1);

	return levels;
}

struct ColorLevel
{
	Vector2Int boardSize;
	Vector2Int pinnedModulo;
	Color ul;
	Color ur;
	Color bl;
	Color br;
};

static const std::vector<ColorLevel> getColorLevels()
{
	std::vector<ColorLevel> levels;

	ColorLevel level1;
	level1.boardSize = Vector2Int(5, 5);
	level1.pinnedModulo = Vector2Int(2, 2);
	level1.ul = Color::fromRGBA(0xFFFFFFFF);
	level1.ur = Color::fromRGBA(0x0000FFFF);
	level1.bl = Color::fromRGBA(0x00FF00FF);
	level1.br = Color::fromRGBA(0xFF0000FF);
	levels.push_back(level1);

	ColorLevel level2;
	level2.boardSize = Vector2Int(5, 5);
	level2.pinnedModulo = Vector2Int(2, 2);
	level2.ul = Color::fromRGBA(0xC40233FF);
	level2.ur = Color::fromRGBA(0x009F6BFF);
	level2.bl = Color::fromRGBA(0x0087BDFF);
	level2.br = Color::fromRGBA(0xFFD300FF);
	levels.push_back(level2);

	ColorLevel level3;
	level3.boardSize = Vector2Int(5, 5);
	level3.pinnedModulo = Vector2Int(2, 2);
	level3.ul = Color::fromRGBA(0xFF0088FF);
	level3.ur = Color::fromRGBA(0x0000FFFF);
	level3.bl = Color::fromRGBA(0x44CC00FF);
	level3.br = Color::fromRGBA(0xFFFF00FF);
	levels.push_back(level3);

	ColorLevel level4;
	level4.boardSize = Vector2Int(7, 7);
	level4.pinnedModulo = Vector2Int(3, 3);
	level4.ul = Color::fromRGBA(0x0000FFFF);
	level4.ur = Color::fromRGBA(0xFFFF00FF);
	level4.bl = Color::fromRGBA(0x00FF00FF);
	level4.br = Color::fromRGBA(0xFF0000FF);
	levels.push_back(level4);

	return levels;
}

struct TriviumComponent : RectangleComponent
{
	std::shared_ptr<TextComponent> textLabel;
	std::shared_ptr<TextComponent> valueLabel;

	TriviumComponent(std::vector<Entity>& entities)
	: textLabel(nullptr)
	, valueLabel(nullptr)
	, RectangleComponent(entities, 2.0f, 0xFFFFFFFF, 0x000000FF)
	{

		textLabel = std::shared_ptr<TextComponent>(
			new TextComponent(entities, "This is a sentence", 0xFFFFFFFF, 16.0f));
		textLabel->setSizeMode(entities, Component::SizeMode_SizeToContents);
		textLabel->setRelativePosition(entities, Vector2(0.0f, 0.4f));
		textLabel->setOffsetPosition(entities, Vector2(10.0f, 0.0f));
		textLabel->setAnchorPoint(entities, Vector2(0.0f, 0.5f));
		
		valueLabel = std::shared_ptr<TextComponent>(
			new TextComponent(entities, "20934", 0xFFFFFF00, 16.0f));
		valueLabel->setSizeMode(entities, Component::SizeMode_SizeToContents);
		valueLabel->setRelativePosition(entities, Vector2(1.0f, 0.4f));
		valueLabel->setOffsetPosition(entities, Vector2(-10.0f, 0.0f));
		valueLabel->setAnchorPoint(entities, Vector2(1.0f, 0.5f));

		addChild(entities, textLabel);
		addChild(entities, valueLabel);
	}

	void setTrivium(std::vector<Entity>& entities, const Trivium& trivium)
	{
		textLabel->setText(entities, trivium.text);
		valueLabel->setText(entities, std::to_string(trivium.value));
	}
};

struct TriviaGame : Screen
{
	std::vector<Trivium> trivia;
	std::vector<uint32_t> currentTriviaIndices;
	std::shared_ptr<ComponentGrid> board;
	
	TriviaGame()
	: trivia(getTrivia())
	, board(nullptr)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(1, 5),
				0.2,
				nullptr,
				[this]()
				{
					auto component = new TriviumComponent(entities);
					return component;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					auto triviumComponent = dynamic_cast<TriviumComponent*>(cell);
					triviumComponent->setTrivium(entities, trivia[state]);
					//printf("jhelms trivium: %s\n", trivia[state].text.c_str());
				}
			)
		);
		//board->setRelativeSize(entities, Vector2(0.5f, 0.7f));
		board->setOffsetSize(entities, Vector2(0.0f, 40.0*5));
		board->setRelativeSize(entities, Vector2(0.9, 0.0));
		board->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		board->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		auto generatorButton = std::shared_ptr<StrokeRectangleComponent>(
			new StrokeRectangleComponent(entities, 2.0f, 0xFFFFFFFF));
		generatorButton->setOffsetSize(entities, Vector2(150.0f, 50.0f));
		generatorButton->setRelativePosition(entities, Vector2(1.0, 0.0));
		generatorButton->setOffsetPosition(entities, Vector2(-25.0f, 25.0f));
		generatorButton->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		generatorButton->enableClicking([](){
		}, [](){
		}, [this](const Vector2& position){
			initialize();
		});

		auto buttonLabel = std::shared_ptr<struct Component>(
			new TextComponent(entities, "GENERATE", 0xFFFFFFFF, 10.0f));
		buttonLabel->setRelativePosition(entities, Vector2(0.5f, 0.4f));
		buttonLabel->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		buttonLabel->setRelativeSize(entities, Vector2(0.85f, 1.0f));

		generatorButton->addChild(entities, buttonLabel);
		rootComponent->addChild(entities, generatorButton);
		rootComponent->addChild(entities, board);

		initialize();
	}

	bool checkIfWinning()
	{
		int64_t lastValue = -1;
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				const Trivium& trivium = trivia[cell->state];
				if (trivium.value < lastValue)
				{
					printf("Mis-ordered value: %lld vs %lld\n", lastValue, trivium.value);
					return false;
				}
				lastValue = trivium.value;
			}
		}
		printf("winning!\n");
		return true;
	}

	void onWin()
	{
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				//assert cell
				auto triviumComponent = std::dynamic_pointer_cast<TriviumComponent>(cell->custom);
				Color valueColor;
				valueColor.alpha = 0xFF;
				valueColor.red = 0x30;
				valueColor.blue = 0x90;
				valueColor.green = 0x90 + ((0xFF-0x90)*row)/board->gridSize.y;
				//printf("setting row %d to %x\n", row, valueColor.rgba());
				triviumComponent->valueLabel->setFillColor(entities, valueColor.rgba());
				triviumComponent->setFillColor(entities, 0x003045FF);
				
				cell->disableDragging();
			}
		}
	}
	void randomize()
	{	
		std::uniform_int_distribution<uint32_t> rowDist(0, board->gridSize.y-1);
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				uint32_t newRow = rowDist(rng);
				board->moveSwap(entities, row, column, newRow, column);
			}
		}
	}

	void initialize()
	{
		board->clear(entities);
		uint32_t boardHeight = 5;
		std::uniform_int_distribution<uint32_t> triviaDist(0, trivia.size()-1);
		currentTriviaIndices.clear();
		for (int32_t j = 0; j < boardHeight; ++j)
		{
			bool selected = false;
			while (!selected)
			{
				uint32_t index = triviaDist(rng);
				if (std::find(currentTriviaIndices.begin(), currentTriviaIndices.end(), index) == currentTriviaIndices.end())
				{
					currentTriviaIndices.push_back(index);
					selected = true;
				}
			}
		}
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->spawn(entities, row, column, currentTriviaIndices[row]);
				auto triviumComponent = std::dynamic_pointer_cast<TriviumComponent>(cell->custom);
				triviumComponent->valueLabel->setFillColor(entities, 0x0);
				cell->enableDragging(
					nullptr,
					[this, cell](){
						board->swapToTop(entities, cell);
					},
					[this, cell](){
						cell->convertOffsetToRelativePosition(entities);
						board->moveToClosestCellAndShift(entities, cell);
						//board->swapWithClosestCell(entities, cell);
						if (checkIfWinning())
						{
							onWin();
						}
					}
				);
			}
		}
		while (checkIfWinning())
		{
			randomize();
		}
		board->relayout(entities);
	}
};

struct ColorGame : Screen
{
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<StrokeRectangleComponent> currentLevelComponent;
	std::shared_ptr<TextComponent> winMessage;
	std::shared_ptr<ComponentGrid> board;
	const std::vector<ColorLevel> levels;
	uint32_t currentLevel;

	ColorGame()
	: levels(getColorLevels())
	, currentLevel(0)
	, background(nullptr)
	, currentLevelComponent(nullptr)
	, winMessage(nullptr)
	, board(nullptr)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		float sidebarWidth = 100.0f;
		auto sidebar = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities, 0xFFFFFFFF));
		sidebar->setRelativeSize(entities, Vector2(0.0f, 1.0f));
		sidebar->setOffsetSize(entities, Vector2(sidebarWidth, 0.0f));
		sidebar->positionMode = Component::PositionMode_VerticalBlock;

		for (int32_t i = 0; i < levels.size(); ++ i)
		{
			static const uint32_t selectedColor = 0x000000FF;
			static const uint32_t unselectedColor = 0x808080FF;
			const ColorLevel& level = levels[i];
			auto levelComponent = std::shared_ptr<StrokeRectangleComponent>(
				new StrokeRectangleComponent(entities, 2.0f, i == 0 ? selectedColor : unselectedColor));
			levelComponent->setOffsetPosition(entities, Vector2(sidebarWidth/5.0f, /*sidebarWidth * i + */sidebarWidth/5.0f));
			levelComponent->setOffsetSize(entities, Vector2(sidebarWidth*3.0f/5.0f, sidebarWidth*3.0f/5.0f));

			auto label = std::shared_ptr<struct Component>(
				new TextComponent(entities, std::to_string(i+1), 0x000000FF, 10.0f));
			label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
			label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
			label->setRelativeSize(entities, Vector2(0.7f, 0.7f));

			levelComponent->enableClicking(nullptr, nullptr, [i, levelComponent, this](const Vector2& position){
				if (currentLevel == i)
				{
					return;
				}
				currentLevel = i;
				levelComponent->setStrokeColor(entities, selectedColor);
				currentLevelComponent->setStrokeColor(entities, unselectedColor);
				currentLevelComponent = levelComponent;
				winMessage->disable(entities);
				initializeForLevel(levels[i]);
			});
			
			levelComponent->addChild(entities, label);
			sidebar->addChild(entities, levelComponent);

			if (i == 0)
			{
				currentLevelComponent = levelComponent;
			}
		}

		auto content = std::shared_ptr<struct Component>(
			new struct Component(entities));
		content->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		content->setOffsetSize(entities, Vector2(-sidebarWidth, 0.0f));
		content->setOffsetPosition(entities, Vector2(sidebarWidth, 0.0f));

		auto randomizerButton = std::shared_ptr<StrokeRectangleComponent>(
			new StrokeRectangleComponent(entities, 2.0f, 0xFFFFFFFF));
		randomizerButton->setOffsetSize(entities, Vector2(150.0f, 50.0f));
		randomizerButton->setRelativePosition(entities, Vector2(1.0, 0.0));
		randomizerButton->setOffsetPosition(entities, Vector2(-25.0f, 25.0f));
		randomizerButton->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		randomizerButton->enableClicking([](){
		}, [](){
		}, [this](const Vector2& position){
			randomize();
		});

		auto buttonLabel = std::shared_ptr<struct Component>(
			new TextComponent(entities, "RANDOMIZE", 0xFFFFFFFF, 10.0f));
		buttonLabel->setRelativePosition(entities, Vector2(0.5f, 0.4f));
		buttonLabel->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		buttonLabel->setRelativeSize(entities, Vector2(0.85f, 1.0f));

		background = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities,0xFFFFFFFF));

		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(7, 7),
				0.0,
				nullptr,
				[this]()
				{
					auto rectangle = new FilledRectangleComponent(
						entities,
						0xFF00FFFF
					);

					auto blackDot = std::shared_ptr<FilledCircleComponent>(
						new FilledCircleComponent(entities, 0x000000FF));
					blackDot->setRelativeSize(entities, Vector2(0.1, 0.1));
					blackDot->setRelativePosition(entities, Vector2(0.5, 0.5));
					blackDot->setAnchorPoint(entities, Vector2(0.5, 0.5));
					rectangle->addChild(entities, blackDot);
					
					return rectangle;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					const ColorLevel& level = levels[currentLevel];
					auto rectangle = dynamic_cast<FilledRectangleComponent*>(cell);
					//assert rectangle not null
					rectangle->setFillColor(entities, state); 

					uint32_t fillColor = 0x0;
					if (row%level.pinnedModulo.y == 0 && column%level.pinnedModulo.x == 0)
					{
						fillColor = 0x000000FF;
					}
					auto circle = std::dynamic_pointer_cast<FilledCircleComponent>(rectangle->children[0]);
					circle->setColor(entities, fillColor);
				}
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		winMessage = std::shared_ptr<TextComponent>(
			new TextComponent(entities, "NICE!", 0xFFFFFFFF, 150.0f));
		winMessage->setSizeMode(entities, Component::SizeMode_SizeToContents);
		winMessage->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		winMessage->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		winMessage->disable(entities);

		background->addChild(entities, board);
		randomizerButton->addChild(entities, buttonLabel);
		content->addChild(entities, background);
		content->addChild(entities, randomizerButton);
		content->addChild(entities, winMessage);
		rootComponent->addChild(entities, sidebar);
		rootComponent->addChild(entities, content);

		initializeForLevel(levels[0]);
		//randomize(levels[0]);
	}

	void onWin()
	{
		winMessage->enable(entities);
	}

	bool checkIfWinning()
	{
		const ColorLevel& level = levels[currentLevel];

		float width = board->gridSize.x - 1;
		float height = board->gridSize.y - 1;
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				//assert cell
				auto rectangle = std::dynamic_pointer_cast<FilledRectangleComponent>(cell->custom);
				//assert rectangle

				float aFraction = ((height - row) * (width - column)) / (width * height);
				float bFraction = ((height - row) * column) / (width * height);
				float cFraction = (row * (width - column)) / (width * height);
				float dFraction = (row * column) / (width * height);
				Color color = Color::interpolate(
					level.ul, level.ur, level.bl, level.br,
					aFraction, bFraction, cFraction, dFraction);
				
				uint32_t targetRgba = color.rgba();
				uint32_t currentRgba = rectangle->getFillColor(entities);
				if (targetRgba != currentRgba)
				{
					printf("Mismatched colors at %dx%d: %x vs %x\n", row, column, targetRgba, currentRgba);
					return false;
				}
			}
		}
		printf("winning!\n");
		return true;
	}

	void initializeForLevel(const ColorLevel& level)
	{
		board->resizeGrid(entities, level.boardSize);
		background->aspectRatio = (float)level.boardSize.x/(float)level.boardSize.y;
		//spawn
		float width = board->gridSize.x - 1;
		float height = board->gridSize.y - 1;
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				float aFraction = ((height - row) * (width - column)) / (width * height);
				float bFraction = ((height - row) * column) / (width * height);
				float cFraction = (row * (width - column)) / (width * height);
				float dFraction = (row * column) / (width * height);

				Color color = Color::interpolate(
					level.ul, level.ur, level.bl, level.br,
					aFraction, bFraction, cFraction, dFraction);
				uint32_t rgba = color.rgba();

				auto cell = board->spawn(entities, row, column, rgba);
				if (row%level.pinnedModulo.y != 0 || column%level.pinnedModulo.x != 0)
				{
					cell->enableDragging(
						nullptr,
						[this, cell](){
							board->swapToTop(entities, cell);
						},
						[this, cell](){
							cell->convertOffsetToRelativePosition(entities);
							swapWithClosestCell(cell);
						}
					);
				}
				else
				{
					cell->disableDragging();
				}
			}
		}

		board->relayout(entities);
	}
	
	void randomize()
	{
		const ColorLevel& level = levels[currentLevel];
		//randomize
		std::uniform_int_distribution<uint32_t> columnDist(0, board->gridSize.x-1);
		std::uniform_int_distribution<uint32_t> rowDist(0, board->gridSize.y-1);
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (row%level.pinnedModulo.y == 0 && column%level.pinnedModulo.x == 0)
				{
					continue;
				}

				uint32_t newRow = 0;
				uint32_t newColumn = 0;
				while (newRow%level.pinnedModulo.y == 0 && newColumn%level.pinnedModulo.x == 0)
				{
					newRow = rowDist(rng);
					newColumn = columnDist(rng);
				}
				board->moveSwap(entities, row, column, newRow, newColumn);
			}
		}
		winMessage->disable(entities);
	}

	void swapWithClosestCell(std::shared_ptr<ComponentCell> cell)
	{
		board->swapWithClosestCell(entities, cell);
		if (checkIfWinning())
		{
			onWin();
		}
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("start 1\n");
	Game game;
	std::shared_ptr<Screen> colorGame = std::shared_ptr<Screen>(new ColorGame());
	std::shared_ptr<TriviaGame> triviaGame = std::shared_ptr<TriviaGame>(new TriviaGame());
	//std::shared_ptr<TriviaGame> triviaGame = std::shared_ptr<TriviaGame>(new TriviaGame());
	game.setScreen(triviaGame);
	bool firstLoop = true;
	int32_t mode = 1;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(colorGame);
					break;
				}
				case 1:
				{
					game.setScreen(triviaGame);
					break;
				}
			}
		}
		game.loop();
		// if (firstLoop)
		// {
		// 	firstLoop = false;

		// 	triviaGame->board->relayout(triviaGame->entities);
		// 	auto cell = triviaGame->board->grid[0][0];
		// 	auto tc = std::dynamic_pointer_cast<TriviumComponent>(cell->custom);
		// 	const Vector2 relativeSize = tc->getRelativeSize(triviaGame->entities);
		// 	printf("upper left tc position: %4.2f, %4.2f - size: %4.2f, %4.2f- relativeSize: %4.2f, %4.2f\n",
		// 		tc->screenPosition.x, tc->screenPosition.y,
		// 		tc->screenSize.x, tc->screenSize.y,
		// 		relativeSize.x, relativeSize.y);

		// 	printf("upper left textLabel position: %4.2f, %4.2f - size: %4.2f, %4.2f- relativeSize: %4.2f, %4.2f\n",
		// 		tc->textLabel->screenPosition.x, tc->textLabel->screenPosition.y,
		// 		tc->textLabel->screenSize.x, tc->textLabel->screenSize.y,
		// 		relativeSize.x, relativeSize.y);

		// 	printf("upper left valueLabel position: %4.2f, %4.2f - size: %4.2f, %4.2f- relativeSize: %4.2f, %4.2f\n",
		// 		tc->valueLabel->screenPosition.x, tc->valueLabel->screenPosition.y,
		// 		tc->valueLabel->screenSize.x, tc->valueLabel->screenSize.y,
		// 		relativeSize.x, relativeSize.y);
		// }
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}