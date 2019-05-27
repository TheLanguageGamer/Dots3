#include "Engine.h"
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

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

struct Level
{
	Vector2Int boardSize;
	Vector2Int pinnedModulo;
	Color ul;
	Color ur;
	Color bl;
	Color br;
};

static const std::vector<Level> getLevels()
{
	std::vector<Level> levels;

	Level level1;
	level1.boardSize = Vector2Int(5, 5);
	level1.pinnedModulo = Vector2Int(2, 2);
	level1.ul = Color::fromRGBA(0xFFFFFFFF);
	level1.ur = Color::fromRGBA(0x0000FFFF);
	level1.bl = Color::fromRGBA(0x00FF00FF);
	level1.br = Color::fromRGBA(0xFF0000FF);
	levels.push_back(level1);

	Level level2;
	level2.boardSize = Vector2Int(5, 5);
	level2.pinnedModulo = Vector2Int(2, 2);
	level2.ul = Color::fromRGBA(0xC40233FF);
	level2.ur = Color::fromRGBA(0x009F6BFF);
	level2.bl = Color::fromRGBA(0x0087BDFF);
	level2.br = Color::fromRGBA(0xFFD300FF);
	levels.push_back(level2);

	Level level3;
	level3.boardSize = Vector2Int(5, 5);
	level3.pinnedModulo = Vector2Int(2, 2);
	level3.ul = Color::fromRGBA(0xFF0088FF);
	level3.ur = Color::fromRGBA(0x0000FFFF);
	level3.bl = Color::fromRGBA(0x44CC00FF);
	level3.br = Color::fromRGBA(0xFFFF00FF);
	levels.push_back(level3);

	Level level4;
	level4.boardSize = Vector2Int(7, 7);
	level4.pinnedModulo = Vector2Int(3, 3);
	level4.ul = Color::fromRGBA(0x0000FFFF);
	level4.ur = Color::fromRGBA(0xFFFF00FF);
	level4.bl = Color::fromRGBA(0x00FF00FF);
	level4.br = Color::fromRGBA(0xFF0000FF);
	levels.push_back(level4);

	return levels;
}

struct GameHue : Screen
{
	std::shared_ptr<RectangleComponent> background;
	std::shared_ptr<StrokeRectangleComponent> currentLevelComponent;
	std::shared_ptr<TextComponent> winMessage;
	std::shared_ptr<ComponentGrid> board;
	const std::vector<Level> levels;
	uint32_t currentLevel;

	GameHue()
	: levels(getLevels())
	, currentLevel(0)
	, background(nullptr)
	, currentLevelComponent(nullptr)
	, winMessage(nullptr)
	, board(nullptr)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		float sidebarWidth = 100.0f;
		auto sidebar = std::shared_ptr<RectangleComponent>(
			new RectangleComponent(entities, 0xFFFFFFFF));
		sidebar->setRelativeSize(entities, Vector2(0.0f, 1.0f));
		sidebar->setOffsetSize(entities, Vector2(sidebarWidth, 0.0f));
		sidebar->positionMode = Component::PositionMode_VerticalBlock;

		for (int32_t i = 0; i < levels.size(); ++ i)
		{
			static const uint32_t selectedColor = 0x000000FF;
			static const uint32_t unselectedColor = 0x808080FF;
			const Level& level = levels[i];
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
				currentLevel = i;
				levelComponent->setStrokeColor(entities, selectedColor);
				currentLevelComponent->setStrokeColor(entities, unselectedColor);
				currentLevelComponent = levelComponent;
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

		background = std::shared_ptr<RectangleComponent>(
			new RectangleComponent(entities,0xFFFFFFFF));

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
					auto rectangle = new RectangleComponent(
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
					const Level& level = levels[currentLevel];
					auto rectangle = dynamic_cast<RectangleComponent*>(cell);
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
		const Level& level = levels[currentLevel];

		float width = board->gridSize.x - 1;
		float height = board->gridSize.y - 1;
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				//assert cell
				auto rectangle = std::dynamic_pointer_cast<RectangleComponent>(cell->custom);
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
					printf("Mismatched colors at %dx%d: %u vs %u\n", row, column, targetRgba, currentRgba);
					return false;
				}
			}
		}
		printf("winning!\n");
		return true;
	}

	void initializeForLevel(const Level& level)
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
		const Level& level = levels[currentLevel];
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
	}

	void swapWithClosestCell(std::shared_ptr<ComponentCell> cell)
	{
		uint32_t inRow = cell->row;
		uint32_t inColumn = cell->column;
		uint32_t closestRow = inRow;
		uint32_t closestColumn = inColumn;
		float minDistance = 1000000;
		std::shared_ptr<ComponentCell> best = nullptr;
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (row == inRow && column == inColumn)
				{
					continue;
				}
				auto other = board->grid[row][column];
				float distance = Vector2::distance(cell->screenPosition, other->screenPosition);
				if (distance < minDistance && other->isDraggable)
				{
					minDistance = distance;
					best = other;
					closestRow = row;
					closestColumn = column;
				}
			}
		}

		if (minDistance < cell->screenSize.x/2.0)
		{
			board->moveSwap(entities, inRow, inColumn, closestRow, closestColumn);
			if (checkIfWinning())
			{
				onWin();
			}
		}
		else
		{
			board->moveSwap(entities, inRow, inColumn, inRow, inColumn);
		}
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("start 1\n");
	Game game;
	std::shared_ptr<Screen> gameHue = std::shared_ptr<Screen>(new GameHue());
	game.setScreen(gameHue);

	int32_t mode = 0;
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
					game.setScreen(gameHue);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}